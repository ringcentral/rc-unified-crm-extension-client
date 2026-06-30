# Client Extension Testing Strategy

## 目的

这份文档记录 Chrome extension client 的测试边界和 TDD 落地顺序。目标不是一次性补完所有测试，而是用 vertical slice 的方式从高价值行为开始：一个行为测试，一个红绿循环，然后再扩大覆盖。

## 系统边界

App Connect client 是 extension runtime 和适配层，不是 CRM 业务执行层。

client 负责：

- 从 Developer Console public API 读取 connector/plugin catalog 和 manifest。
- 缓存 active manifest、platform info、JWT、用户设置和 admin 设置到 `chrome.storage.local`。
- 根据 manifest、当前 URL、用户设置决定是否在 CRM 页面启用 quick access button 和 click-to-dial。
- 托管 RingCentral Embeddable widget，把 widget `postMessage` 路由到 client handlers。
- 调用 server API 发起 auth、contact match、call/message log、admin、plugin、appointment、calldown 等操作。
- 管理 Chrome extension 生命周期：popup window、OAuth window、notification、cold-start click-to-X intent。

client 不负责：

- 持久化 CRM session、call log、message log、admin config。
- 执行 connector/proxy 的 CRM API 逻辑。
- 审核、发布、存储 connector/plugin manifest。
- 验证 server connector registry 是否正确执行具体 CRM 操作。

这些分别属于 server 和 Developer Console 的测试范围。

## TDD 规则

测试应优先验证公开行为，而不是内部实现细节。

- 每个循环只加一个行为测试。
- 先跑出失败，再补最小代码或测试基础设施让它通过。
- 测试名称使用业务词：manifest、platform、connector、plugin、click-to-dial、quick access、auth、log。
- mock 边界放在外部系统：Chrome API、HTTP API、DOM/window、RingCentral Embeddable。
- 不 mock 被测模块内部函数。

## 测试层次

### 1. Contract/unit-style tests

适合先落地，因为速度快、依赖少。

候选模块：

- `src/service/manifestService.js`
- `src/service/platformService.js`
- `src/core/user.js` 中的 setting getter
- `src/core/auth.js` 中的 OAuth URL/API key auth/JWT state 行为
- `src/core/contact.js` 中的 contact match cache 和 open URL 规则
- `src/core/log.js` 中的 call/message log request payload
- `src/service/pluginService.js`

主要 mock：

- `chrome.storage.local`
- `axios`
- `localStorage`
- `window.open`

### 2. Message-router tests

验证 popup 和 Embeddable 之间的行为 contract。

候选模块：

- `src/eventHandlers/rc-post-message-request/index.js`
- `/contacts/match`
- `/callLogger`
- `/messageLogger`
- `/custom-button-click`
- `/customizedPage/inputChanged`
- `src/messageHandlers/*`

主要断言：

- 输入的 widget event 被路由到正确公开行为。
- 未授权时阻止 call/message log 并通知用户。
- handler 最终通过 `responseMessage` 回应 widget。

### 3. Extension-runtime tests

验证 Chrome extension 生命周期。

候选模块：

- `src/sw.js`
- `src/content.js`
- `src/components/embedded/*`

主要 mock：

- `chrome.runtime`
- `chrome.windows`
- `chrome.tabs`
- `chrome.notifications`
- `chrome.alarms`
- DOM/window URL

主要断言：

- popup 已存在时 focus，而不是创建重复窗口。
- OAuth window callback 命中 redirect URI 后发送 `oauthCallBack`。
- click-to-dial cold start 会缓存最新 intent。
- quick access 和 C2D 只在匹配 URL/用户设置时启用。

## CI 执行入口

默认 GitHub Actions `Build, Package, and Release` workflow 现在在 pull request、手动触发、`release` 分支 push 和 tag build 上执行 `npm test`，再执行 `npm run build` 并产出 `dist.zip` artifact。这样 client unit/contract tests 会在 release package 生成前阻断回归。

浏览器级 smoke 保持为单独的手动 `Browser E2E Smoke` workflow：它执行 install、build、`npm run test:e2e`，并在 Ubuntu runner 上通过 `CHROME_PATH=/usr/bin/google-chrome` 使用系统 Chrome。这个 workflow 适合在 extension packaging、content script、service worker 或 C2D runtime 相关改动后手动跑，不先作为所有 PR 的必过项。
### 4. Browser-level E2E tests

已有最小无 Playwright smoke：`npm run test:e2e` 会用 Chrome/Edge 加载 `dist` unpacked extension、打开 popup shell，在真实 popup 中用本地 manifest server 验证 `/implementedInterfaces?platform=...` 请求和 storage 持久化，在本地 HTTP CRM 测试页验证 content script 注入 quick access root，C2D Call action 能通过 extension runtime 打开 popup，并验证 Pipedrive direct-page callback 能经 content script/service worker/popup 完成 `/oauth-callback` token exchange。现在还覆盖多条真实 popup 到 server 的业务 tracer bullet：手动 call log `/callLog`、手动 message log `/messageLog`、appointment confirm `/appointments/{appointmentId}/confirm` + `/appointments` refresh、appointment create `/appointments` POST + `/appointments` refresh、appointment edit `/appointments/{appointmentId}` PATCH + `/appointments` refresh、admin plugin install `/admin/settings` + `/plugin/register`、plugin auth `authorizationUrl?pluginId=...` + OAuth window + cached config、plugin logout `logoutUrl` + `/plugin/licenseStatus` refresh，以及 plugin config submit `/user/settings`。

Call log E2E 的第一条业务路径固定为“已有 contact 的手动 call log 创建”。测试使用真实 Chrome 加载 built popup，在 popup 页面里发送 Embeddable 等价的 `rc-post-message-request`，由本地 server 捕获 `/callLog` request。断言范围只包含稳定业务 contract：CRM JWT authorization、call `sessionId` 与核心通话字段、form note/subject、已有 contact 的 `contactId/contactType/contactName`、manifest additional fields、RingCentral additional submission、overriding phone format 和 `extensionNumber`。测试不依赖真实外部 CRM、真实 RingCentral widget 网络状态，也不 snapshot widget DOM。

Message log E2E 的第一条业务路径固定为“已有 contact 的手动 SMS message log 创建”。测试同样使用真实 Chrome 加载 built popup，在 popup 页面里发送 Embeddable 等价的 `/messageLogger` `rc-post-message-request`，由本地 server 捕获 `/messageLog` request，并等待 extension 把 `rc-crm-conversation-log-{conversationLogId}` 写回 storage。断言范围只包含稳定业务 contract：CRM JWT authorization、conversation/message 核心字段、已有 contact 的 `contactId/contactType/contactName`、manifest message additional fields、RingCentral additional submission、overriding phone format，以及不会误创建 `/contacts`。

Appointment E2E 的第一条业务路径固定为“用户在 appointments list 里确认一个已有 appointment”。测试使用真实 Chrome 加载 built popup，在 popup 页面里发送 Embeddable 等价的 `/custom-button-click`，button id 使用 `appointmentConfirm-{appointmentId}-action`。本地 server 必须先收到 `/appointments/{appointmentId}/confirm`，随后收到 `/appointments` list refresh；断言范围只包含稳定 client/server contract：JWT query 和 bearer authorization、list refresh 的 tab/filter 参数、确认成功后不再 fallback 到 `/appointments/{appointmentId}/status`。
Appointment create E2E 的第一条业务路径固定为“用户在 appointment create page 提交一个已有 contact 的新 appointment”。测试使用真实 Chrome 加载 built popup，在 popup 页面里发送 Embeddable 等价的 `/custom-button-click` submit，button id/page id 使用 `appointmentCreatePage`。本地 server 必须先收到 `/appointments` POST，随后收到 `/appointments` list refresh；断言范围只包含稳定 client/server contract：JWT query、CRM JWT bearer authorization、create payload 的 title/summary/startTimeUtc/durationMinutes/status/contact/contacts 字段，以及按 `returnTab`/`returnSearch`/`returnFilter` 触发 `forceSync=true` 的 list refresh。
Appointment edit E2E 的第一条业务路径固定为“用户在 appointment edit page 更新一个已有 appointment”。测试使用真实 Chrome 加载 built popup，在 popup 页面里发送 Embeddable 等价的 `/custom-button-click` submit，button id/page id 使用 `appointmentEditPage`。本地 server 必须先收到 `/appointments/{appointmentId}` PATCH，随后收到 `/appointments` list refresh；断言范围只包含稳定 client/server contract：JWT query、CRM JWT bearer authorization、patch payload 的 title/summary/startTime/durationMinutes/status/contact/contacts/attendees/attendeeIds 字段，以及按 `returnTab`/`returnSearch`/`returnFilter` 触发 `forceSync=false` 的 list refresh。

Plugin install E2E 的第一条业务路径固定为“admin 在 plugin configure page 安装 public plugin”。测试使用真实 Chrome 加载 built popup，并用 CDP Fetch mock 固定 Developer Console plugin catalog response，避免访问真实 `appconnect.labs.ringcentral.com`。本地 server 必须收到 `/admin/settings` 保存 admin plugin setting，随后收到 `/plugin/register`；断言范围只包含稳定 contract：RC access token query、CRM JWT authorization、plugin metadata、hidden config field 的 `customizable=false` 初始化、RingCentral account id，以及注册成功时不写 rollback `isRemoved=true`。

Plugin config submit E2E 的第一条业务路径固定为“用户在 plugin configure page 保存配置”。测试使用真实 Chrome 加载 built popup，在 popup 页面里发送 Embeddable 等价的 `/custom-button-click` submit，button id 为 `pluginConfigurePage`。本地 server 必须收到 `/user/settings` POST；断言范围只包含稳定 contract：CRM JWT authorization、RingCentral account id、已有 config 与新 config merge、page-generated `logTypes` 被保存为 `supportedLogTypes`，以及保存成功后返回 widget。
Plugin auth E2E 的第一条业务路径固定为“用户在 plugin configure page 点击第三方授权按钮”。测试使用真实 Chrome 加载 built popup，在 popup 页面里发送 Embeddable 等价的 `/custom-button-click`，button id 为 `pluginAuthButton`，formData 带 `pluginId` 和 plugin `authorizationUrl`。本地 server 必须收到 `authorizationUrl?pluginId=...`；断言范围只包含稳定 contract：client 会请求 plugin authorization URL、打开第三方 OAuth URL，并把当前 plugin config formData 缓存到 `cachedPluginConfigFormData`，供 OAuth callback 后恢复配置页。

Plugin logout E2E 的第一条业务路径固定为“用户在 plugin configure page 点击 logout”。测试使用真实 Chrome 加载 built popup，在 popup 页面里发送 Embeddable 等价的 `/custom-button-click`，button id 为 `pluginLogoutButton`，formData 带 `pluginId`、plugin `logoutUrl`、已有配置和 plugin license metadata。本地 plugin logout endpoint 必须收到 CRM JWT；logout 成功后本地 server 必须收到 `/plugin/licenseStatus?rcAccountId=...&pluginId=...`。断言范围只包含稳定 contract：client 会把 CRM JWT 传给 plugin logout endpoint，并在成功后用 RingCentral account id 刷新 plugin license status；不 snapshot widget DOM。
Pipedrive callback E2E 的第一条业务路径固定为“Pipedrive direct-page 授权页把 callback URI 交回 extension”。测试使用真实 Chrome 加载 built popup 和本地 `/pipedrive-redirect?code=...` 页面；content script 会把当前 URL 发给 service worker，service worker 把它转给 popup。本地 server 必须收到 `/oauth-callback`，其中 `callbackUri` 包含原页面 URL 和 `state=platform=pipedrive`；成功后 extension storage 必须写入 CRM JWT，并且安装页 stepper 收到完成通知。断言范围只包含稳定 client/server/runtime contract，不访问真实 Pipedrive，也不 snapshot widget DOM。

覆盖目标：

- extension popup 可打开。
- content script 在测试 CRM 页面渲染 quick access。
- 点击电话号码触发 C2D intent。
- popup 能根据 `customCrmManifest.serverUrl` 请求 server `/implementedInterfaces?platform=...` 并把能力结果写入 Chrome storage。
- popup 收到手动 call log 创建请求后，会向 server `/callLog` 发出正确业务 payload。
- popup 收到手动 message log 创建请求后，会向 server `/messageLog` 发出正确业务 payload，并在 server 成功后缓存 conversation log 状态。
- popup 收到 appointment confirm action 后，会向 server `/appointments/{appointmentId}/confirm` 发出确认请求，再刷新 `/appointments` list，并且确认成功时不走 generic `/status` fallback。
- popup 收到 appointment create submit 后，会向 server `/appointments` 发出 create payload，成功后按 return list context 触发 `forceSync=true` 的 `/appointments` refresh。
- popup 收到 appointment edit submit 后，会向 server `/appointments/{appointmentId}` 发出 patch payload，成功后按 return list context 触发 `forceSync=false` 的 `/appointments` refresh。
- popup 收到 admin plugin install action 后，会保存 admin plugin setting、调用 server `/plugin/register`，并且成功时不写 rollback marker。
- popup 收到 plugin auth button 后，会请求 plugin `authorizationUrl?pluginId=...`，打开第三方 OAuth URL，并缓存当前 config formData。
- popup 收到 plugin logout button 后，会向 plugin `logoutUrl` 发送 CRM JWT，并在 logout 成功后刷新 server `/plugin/licenseStatus`。
- Pipedrive direct-page callback 会从 content script 进入 service worker/popup，向 server `/oauth-callback` 发送带 `state=platform=pipedrive` 的 callback URI，并在成功后写入 CRM auth storage、通知安装页完成。
- popup 收到 plugin configuration submit 后，会把真实 page formData 的 `logTypes`、merged config 和 RingCentral account id 保存到 `/user/settings`。

## 第一批 TDD slices

1. `manifestService` 会合并 public/shared/private connector list，并给每项标记 `access`。
2. `manifestService.saveManifest` 会按 active platform 应用 `meta` override 和 hostname override，然后持久化到 `customCrmManifest`。
3. `platformService.clearPlatformInfo` 会清除 platform 相关 auth/cache state。
4. `user` setting getter 在缺失配置时返回稳定默认值。
5. `/contacts/match` 对多个号码一次处理一个，并触发下一轮 contact match。

先从第 1、2 个 slice 开始，因为它们是 client 与 Developer Console manifest contract 的核心交界面。

## 当前约束

client 当前没有测试脚本，也没有 Jest/Vitest 依赖。为了避免先引入网络依赖，第一阶段使用 Node 内置测试框架和项目已有的 `esbuild` 本地依赖加载 ESM/JSX 源文件。后续如果需要组件测试或浏览器 E2E，再评估是否引入 Vitest、Testing Library、Playwright。

## 本轮补充的 TDD slices

6. `auth.buildOAuthUrl` 会把 manifest 或托管 OAuth 配置转换成第三方授权 URL，并编码 client id、scope、redirect URI。
7. `contact.openContactPage` 在 fallback contact page 场景拒绝 unsafe URL，避免 manifest 配置把 extension 带到非 http/https 或 `javascript` URL。

## 本轮已确认的 client 职责

### Auth

client 负责把 active manifest、platform auth 配置、托管 OAuth 状态和当前用户操作串起来：

- 普通 OAuth：从 `platform.auth.oauth` 生成授权 URL，然后通过 Chrome runtime 打开第三方授权窗口。
- 托管 OAuth：先向 server 查询 account 是否已有 OAuth values；没有配置时，client 决定展示 admin setup page 或 missing page。
- API key auth：client 负责展示表单、提交 server、接收 JWT，并把本地 `crmAuthed`、用户设置和 server-side logging token 同步到 extension storage。

server 负责 OAuth/API key 的后端交换、JWT 和托管凭据状态；Developer Console 负责 manifest 配置来源。client 测试应验证它如何消费这些 contract，而不是替代 server/portal 测试。

### Contact Page

client 负责把 phone number、contact cache、server contact match 结果和 manifest URL template 转成浏览器行为：

- 有明确 contact id 或单一匹配时，按 `contactPageUrl` 或 call pop URL 打开 CRM contact page。
- 无匹配且从 call pop 触发时，可以使用 platform 的 fallback contact page URL。
- fallback URL 是 extension 打开新窗口前的最后一道边界，所以 client 必须拒绝 unsafe URL。

这个行为适合放在 client 测试里，因为它直接影响浏览器窗口、用户安全和 extension runtime，而不是 server 的 CRM 查询能力。

补充：user.getAutoLogCallSetting 在 account-level server-side logging 开启时锁定 auto-log call，确保 client UI 遵守 admin 管理边界。

## 本轮补充：Widget Message Router

client 的 `rc-post-message-request` 是 RingCentral Embeddable widget 进入 extension 业务逻辑的主要 contract。这个 router 层负责：

- 每次请求前读取 active manifest、platform info 和 CRM auth state。
- 未授权时拦截 `/callLogger`、`/messageLogger`，提示用户连接 CRM，并给 widget 一个完成响应。
- 按 `data.path` 把请求转给 contacts、call logger、message logger、settings、自定义页面和按钮 handler。
- 对 `/contacts/match` 这种批量输入，client 一次只处理第一个号码，再通过 `rc-adapter-trigger-contact-match` 触发剩余号码，避免一次请求过重导致 widget 超时。

这些测试验证的是 extension 与 widget 的消息 contract：输入 `data.path` / `requestId` / `body`，输出 `responseMessage`、notification、storage 或 `postMessage`。server 仍然只负责实际 CRM 查询和日志执行；Developer Console 仍然只负责提供 manifest 能力描述。

## 本轮补充：Chrome Runtime Message Handlers

`src/messageHandlers/*` 是 service worker/background 与 popup/widget 之间的另一条 client contract。它们接收 Chrome runtime message，然后把用户 intent 转成 Embeddable widget message。

已确认的职责包括：

- `c2d` 把点击拨号 intent 转成 `rc-adapter-new-call`。
- `c2sms` 把点击短信 intent 转成 `rc-adapter-new-sms`，并在本地 contact cache 有匹配时补上 recipient name。
- `navigate` 把外部导航 intent 转成 widget navigation，feedback/support 这类页面由 client 组装 customized page。
- `oauthCallBack` 处理 RingCentral OAuth callback 和第三方 CRM OAuth callback，并负责把认证后需要即时注册的 tab/page 推给 widget。

这类测试应断言 `postMessage`、`sendResponse`、storage 更新和必要的 server/core 调用，不直接断言 DOM 内部细节。

## 本轮补充：Logging 与 OAuth Runtime Contract

`core/log.addLog` 是 client 与 server 日志执行层之间的关键 contract。client 不直接执行 CRM call/message log，但负责在调用 server 前补齐这些上下文：

- `rcUnifiedCrmExtJwt` 决定是否允许调用 server log API。
- `userSettings` 中的 overriding phone number format 会进入 `overridingFormat`。
- `rcAdditionalSubmission` 会合并到当前表单或自动选择的 `additionalSubmission`。
- call log 会补 `extensionNumber`，recording 已存在时会补带 RC access token 的 `downloadUrl`。
- server 成功后，client 会缓存 call/message log 状态，并触发 widget matcher 刷新。

OAuth runtime contract 分两层：

- RingCentral OAuth callback：client 把 RC authorization code 转发给 widget，并清理旧 CRM JWT，避免 stale CRM auth state。
- Pipedrive callback URI：Pipedrive direct-page 授权流把当前页面 callback URL 交给 popup；client 会追加 `state=platform=pipedrive` 调 server token exchange，保存 CRM auth state，刷新登录后 tabs/settings，并通知安装页 `pipedriveAltAuthDone`。
- Managed OAuth：client 在 CRM 可见前查询 server 的 managed OAuth state；如果 account OAuth values 缺失，client 注册 setup/missing customized page 并阻止继续进入 CRM 体验。

这些测试的边界是 client 组装、缓存和 widget 通知；server 仍负责真正的 CRM 日志写入、token 交换和托管凭据存储。

## 本轮补充：P0 行为覆盖

本轮按优先级补了五个高价值 client contract：

- `/callLogger` 遇到 extension number 时，不进入 log 查询或子 handler，提示用户并返回 widget `ok`。
- `/messageLogger` 遇到 extension number correspondent 时，不进入 message log 流程，提示用户并返回 widget `ok`。
- `/messageLogger` 在已有 conversation preference 时，auto log 会直接使用缓存的 contact 和 additional submission，不重新 contact match。
- `sw.js` 收到 `openPopupWindow` 时，如果已有 popup window，会 focus 现有窗口，不创建重复 popup。
- `embeddableServices.getServiceManifest` 会把核心 widget paths、授权状态、buttons、managed SMS auto-log 状态暴露给 RingCentral Embeddable，并发送 phone format / SMS typing tracking 设置消息。

这些测试继续遵守同一个边界：验证 client 对 widget、Chrome API、storage、server contract 的可见行为，不测试 server connector 内部执行，也不 snapshot 大型 UI object 的全部形状。

## 本轮补充：P1 Service / Settings / Admin Contract

本轮继续补了 P1 的高可操作性行为：

- `/settings` 普通保存路径：client 会把 widget 传入的嵌套 settings 展平成 `changedSettings`，调用 `refreshUserSettings`，提示保存成功并返回 widget `ok`。
- `appointmentService.listAppointments`：client 会按 server contract 传 `jwtToken`、`range`、`mineOnly`、`forceSync`，并 normalize backend 返回的 `records/items/appointments/data` 等 wrapper。
- `appointmentService.updateAppointmentStatus`：client 先尝试 canonical confirm/cancel endpoint，失败时 fallback 到 generic `/status` endpoint。
- `pluginService.getPluginLicenseStatus`：client 会用 RingCentral account id 查询 server plugin license status。
- `pluginService.checkAndUpdatePluginVersion`：client 会根据 Developer Console plugin catalog 识别已安装 plugin 的版本升级，生成 user setting update，并通知用户。
- `admin.getManagedAuthSettings`：client 会把 CRM JWT、RC access token、connector id、private/shared 标识带到 server 请求，并把返回的 managed auth settings 缓存到 local storage。

这些测试继续优先验证跨边界 contract：widget input、storage、HTTP URL/body、notification、response。复杂 UI render object 仍只测关键字段，不做完整 snapshot。

## 本轮补充：Platform Selection / Developer Console Manifest Contract

`custom-button-click/auth/selectPlatform` 是用户从 Developer Console connector catalog 进入具体 CRM 授权流程的入口。client 在这里消费 portal 提供的 connector id、access type 和 manifest URL，而不是自行决定 connector 能力。

本轮补充的 fixed environment public connector 测试确认：

- client 会从 `platformPublicListUrl/{connectorId}/manifest?type=connector` 拉取公开 connector manifest，并保存当前 manifest URL。
- client 会持久化 active manifest，再从 `environment.url` 提取 hostname，写入 `platform-info`。
- public connector 的 `isPrivate` 为 `false`；shared/private connector 的 `true` 路径已在后续 Platform Selection 分支测试覆盖。
- fixed environment 且无 instructions 时，client 不展示 hostname 输入页，而是直接注册第三方 service、导航到 `/settings`。
- 进入 CRM 授权前，client 仍会执行 managed OAuth visibility check；未被 blocked 时才调用 `onUserClickConnectButton`。

这个测试把 Developer Console、extension storage、RingCentral Embeddable widget 和 auth runtime 的边界连起来。dynamic/manual hostname、managed OAuth blocked、shared/private account scoped manifest URL 已在下一组 Platform Selection 分支测试里继续收敛。

## 本轮补充：Platform Selection 分支扩展

在 fixed public connector 主路径之外，本轮继续补了三个高风险分支：

- managed OAuth blocked：client 已经保存 fixed environment 的 `platform-info` 并注册 service 后，如果 server-side managed OAuth 状态阻止 CRM 可见，extension 必须关闭 loading，并且不能调用 `onUserClickConnectButton`。
- hostname input：当 connector manifest 的 environment 仍需要用户确认 hostname 或 instructions 时，client 不应直接进入授权，而是注册 hostname input customized page 并导航到该页面。
- private connector scope：private connector 的 manifest URL 必须带 `access=internal&type=connector&accountId={RingCentral account id}`，并把 `platform-info.isPrivate` 写为 `true`。

这些分支共同定义了 client 对 Developer Console connector access type、server managed auth 状态和 widget customized page contract 的消费方式。

## 本轮补充：Hostname Submit 与 Click-to-X Runtime

本轮继续补了 hostname 页面提交和 Chrome runtime message handlers：

- `hostnameInputPage` submit：client 会从 dynamic/selectable/fixed URL 解析 hostname，保存 `platform-info`，强制重新读取 manifest 并保存 active manifest，然后注册 service、导航 `/settings`，再进入 managed OAuth check 和 CRM 授权。
- `c2d`：Chrome runtime 收到 click-to-dial intent 后，client 只向 widget 发送 `rc-adapter-new-call`，并向 runtime 返回 `ok`。
- `c2schedule` 打开页：client 会强制触发 contact match，过滤掉 `isNewContact` 占位项，生成包含已有 contact 和 `Create new contact` 的 schedule customized page。
- `c2schedule` 提交：client 会用 RC account id 调用 server `/calldown`，缓存用户选择的 contact 信息，刷新 calldown page，返回 widget response，并移除临时 message listener。

这些测试覆盖的是 extension runtime intent 到 widget/customized page/server API 的桥接职责。server 仍负责真正创建 calldown record；client 负责组装请求、刷新 widget 页面和维护本地 contact cache。

## 本轮补充：Navigation Runtime 与 Call Logger 保护分支

本轮补充了 runtime navigation 和 call logger 的用户可见保护行为：

- `navigate` generic path：client 会把 `/dialer` 等普通 widget path 直接转发给 Embeddable，并返回 Chrome runtime `ok`。
- `navigate` feedback path：client 会从 active manifest 读取 platform feedback 配置和 extension version，注册 feedback customized page，导航到该页面，并记录 open feedback analytics。
- `navigate` support path：client 会调用 server `/isAlive` 判断在线状态，读取 RingCentral account id，把 `isOnline` 和 `rcAccountId` 传给 support page；server 或 RC info 不可用时仍然打开 support page，只降级为 offline/null account。
- feedback submit：client 会用 manifest feedback URL template、表单字段、CRM 名称、RC user 和 extension version 生成外部反馈表单 URL，打开新窗口，然后让 widget `goBack`。
- about button：client 会用当前 platform 和 manifest 注册 about page，并导航到 `/customized/aboutPage`。
- `/callLogger` queue answered elsewhere：queue forwarding 且 answered elsewhere 的通话不会进入普通 log flow；client 会触发 widget matcher、缓存 queue warning、响应 widget，并在 redirect 场景提示用户不能记录该通话。
- `/callLogger` one-time log waiting for recording：当 recording 数据尚未 ready 且用户触发 redirect 时，client 会打开临时 note page，允许用户先填写备注，同时缓存 `call-log-data-ready` 状态并返回 widget `ok`。

这些测试继续保持边界清晰：navigation 测 widget postMessage/window.open/analytics，call logger 测早期拦截后的 storage、notification、widget response，不替代 server 的 CRM log 执行测试。

## 本轮补充：Content Script / Browser Page Injection

本轮补充了 `content.js` 的浏览器页面注入职责。这里是 extension 与真实 CRM 页面之间的边界，测试通过 Chrome storage、DOM、ReactDOM.render、RingCentralC2D 和 runtime message 来验证可见行为：

- embedding disabled：当 quick access 和 click-to-dial embed mode 都是 `disabled`，content script 不应 render quick access，也不应初始化 C2D。
- CRM URL matched：当当前 URL 命中 manifest `embedUrls`，content script 会创建 quick access root、render React 入口、初始化 document.body 的 C2D，并把 widget 的 call/text/schedule 事件转成 `c2d`、`c2sms`、`c2schedule` extension message。
- all-page embedding：当 `allowEmbeddingForAllPages=true`，即使当前 URL 不在 CRM `embedUrls` 里，content script 也会允许 quick access 和 C2D 注入；SMS 按 `userPermissions.c2sms` 控制。
- `openAppWindow` runtime message：background 请求打开窗口时，content script 会向页面和 widget 同步 `minimized=false`，让嵌入 widget 展开。
- `autoOpenExtension`：当设置打开且当前 hostname 等于 registered CRM hostname，content script 会请求 service worker 打开 popup window。
- Pipedrive callback URI：Pipedrive 授权辅助流程需要当前页面 URL 时，content script 会把 `window.location.href` 作为 `pipedriveCallbackUri` 发回 extension。

这些测试不验证 C2D 库内部如何识别电话号码，也不验证 React UI 细节；client 责任是按 manifest/user settings 决定是否注入，并把页面内用户动作桥接为 extension runtime message。

## 本轮补充：C2D Internals / Service Worker Runtime

本轮继续补了 content script 之后的 C2D 支撑模块，以及 service worker 的 runtime 中枢行为：

- `domIgnore`：client 会同时支持默认忽略选择器 `[data-rc-c2d-ignore="true"], .rc-c2d-ignore` 和 manifest/user 配置的自定义 ignore selector；自定义 selector 外层引号会被 normalize；shadow DOM 内节点会回溯到 host 判断是否应忽略。
- `InputAwareRegExpMatcher`：client 会保留未被忽略的 text matcher 结果，并额外扫描 `input/textarea/select` 的 visible value；hidden、disabled、ignored value node 不会生成 C2D match；shadow DOM input 的号码会额外绑定 host fallback，支持组件库把事件挂在 host 上的场景。
- `shadowRootSupport`：client 会初始化已有 tagged shadow root，也会监听 MAIN-world attachShadow patch 事件；对 shadow DOM 中疑似电话号码的 input/focus/change，会设置 probe attribute 触发 C2D 重新扫描，并做 300ms 节流。
- `sendMessageToExtension`：正常情况下直接代理 `chrome.runtime.sendMessage`；当 Chrome API 抛出 `Extension context invalidated` 时，client 会记录 analytics error，并提示用户刷新当前页面。
- service worker click-to-X cold start：当 popup 不存在时，service worker 会缓存最新 `c2d/c2sms/c2schedule` intent，打开 popup，并在 popup 请求 `checkForClickToXCache` 时返回缓存后清空。
- service worker click-to-X existing popup：当 popup 已存在但最小化时，service worker 会恢复窗口、聚焦窗口，并把最新 intent 直接转发给 popup。
- service worker OAuth polling：打开 RingCentral OAuth popup 后，service worker 会保存 `loginWindowInfo` 并创建 `oauthCheck` alarm；当 login window URL 命中 redirect URI，会发送 `oauthCallBack` runtime message、关闭 OAuth window 并清理状态。
- incoming call notification：当 popup 已存在但最小化或未聚焦，service worker 会创建 incoming call notification 并让窗口 draw attention；同一个 call id 在 TTL 内不会重复创建通知。

这些测试把 C2D 页面扫描、Chrome runtime message、popup window lifecycle、OAuth callback lifecycle 和 incoming call notification 串起来。它们仍只验证 client extension 责任：何时扫描、何时打开/聚焦窗口、何时转发消息、何时提示用户；不验证第三方 C2D 库内部算法或 server/CRM 后端行为。

## 本轮补充：Call / Message Logger Form 与 Sync Flow

本轮补充了日志表单提交、自动日志创建和录音同步路径，覆盖 widget log page 到 server log API 之间的 client 责任：

- call log form create：当用户在 call log form 里选择 `createNewContact`，client 会先创建 CRM contact，按用户设置打开 contact page，再调用 `addLog` 创建 call log；如果用户同时选择 schedule callback，client 会调用 server `/calldown` 并刷新 Call Back tab；如果 connector 支持 call disposition，client 会把 additional fields 和 note 同步到 disposition，并从 unlogged call page cache 移除已记录通话。
- call log form edit：编辑已有 call log 时，client 不创建 contact、不新增 log，而是调用 `updateLog`，并在 disposition 支持开启时同步 updated disposition。
- call logger createLog auto path：自动记录 call 且 contact match 无冲突时，client 会直接用 matched contact、cached note 和自动选择的 additional submission 调用 `addLog`；如果支持 disposition 且不是 one-time log，会继续 upsert disposition。
- callLogSync：当 existing call log 已 matched 且 recording link 到达时，client 会同步 call data，记录 recording-link update analytics 的 start/finish，并清理 pending recording session；没有 matched log 时不会同步，也不会清理 pending marker。
- message logger group SMS auto path：group SMS 不支持 auto log，client 会提示用户手动记录，并立即 response widget `ok`，不做 contact match 或 addLog。
- message logger manual createNewContact：手动提交 message log form 时，client 会先创建 contact，按用户设置打开 contact page，再调用 `addLog` 创建 message log。
- message logger group manual open page：用户手动打开 group message log 时，client 会逐个 correspondent 做 contact match，缓存 log page data，按 connector 能力启用 contact search，生成 group log page，执行默认表单值填充，然后导航到 `/log/messages/{conversationId}`。

这些测试覆盖的是 client 对 widget form data、Chrome storage、contact API、log API、calldown API、disposition API 和 widget navigation 的编排。server 仍负责真正写入 CRM log、创建 contact、创建 callback record 和保存 disposition。

## 本轮补充：Admin Settings / Appointments / Platform Runtime

本轮补充了 admin 配置、appointment button 和平台特定 runtime message handler 的 client contract：

- managed auth org submit：client 会根据 `managedAuthSettings.orgFields` 组装 account-scope values，并对已存值但本次清空的字段生成 `fieldsToRemove`，调用 `saveManagedAuthSettings` 后提示成功并返回上一页。
- managed auth user submit：client 会过滤 RingCentral User/Department，保存指定 `rcExtensionId` 的 user-scope managed auth values，更新本地 `managedAuthSettings.userValues`，刷新 user list page，并返回上一页。
- server-side logging submit：client 会先 response widget 防止超时，再刷新 user settings、上传 admin settings、enable/disable server-side logging、刷新 Embeddable service manifest，并提交 additional field values。
- appointment confirm：client 会用 CRM JWT 调 `updateAppointmentStatus`，再按当前 tab/search/filter 刷新 appointment list 并响应 widget。
- appointment create：client 会提交 create form；成功后提示、按 `returnTab`/`returnSearch`/`returnFilter` 刷新 list 并导航，失败时只提示错误不刷新 list。
- controlCall / RingSense / Pipedrive / Insightly runtime：client 会把 call control 转发给 widget，记录 RingSense referral，Pipedrive 已授权时短路返回，Insightly API key 登录后注册 report/calldown/admin pages 并打开 popup。

## 本轮补充：Calldown Buttons 与 Error Logging

本轮补充了 callback/call later 和错误日志上报链路，继续验证 client 在 widget、Chrome storage 和 server API 之间的编排职责：

- call later：extension number 不能进入 callback scheduling；client 会提示用户并响应 widget，不发送 `c2schedule` runtime message。联系人页的 extension phone 会优先选择 direct number 作为 `c2schedule` 号码。
- calldown call：client 会从 `calldownListCache` 找到 callback row，向 widget 发送 `rc-adapter-new-call`，调用 server `/calldown/{id}` 标记 `called`，并带上 RingCentral account scope 刷新当前筛选列表。
- calldown remove / complete：client 会根据 button/list item 中的 row id 调用 delete/patch，并保留当前 search/filter 重新注册 calldown customized page。
- schedule submit：当用户选择 `newContact` 时，client 会先创建 CRM contact，再创建或更新 server callback record，缓存 callback contact 信息，触发 contact match，刷新 calldown page 并返回上一页。
- calldown edit：client 会从本地 callback cache 取 row，强制刷新 contact match，过滤 `isNewContact` 占位项，生成预填 datetime/contact 的 edit schedule page，并导航到该 page。
- report issue：client 会从 RingCentral widget storage 读取用户 email，打开 error log record page。
- error log record：client 会缓存用户 issue description，进入确认/录制步骤，启动 `logRecorder`，并记录 platform、RC account/extension、extension version 等基础上下文。
- log record submit：client 会把用户描述写入 recorder，停止录制并上传日志；成功和失败都会关闭 loading，提示用户，并返回上一页。

这些测试仍不验证 server 如何保存 callback 或日志文件，也不验证 CRM contact/search 的真实网络行为；client 测试只约束请求组装、状态缓存、页面注册、通知和 widget/runtime message。

## 本轮补充：Plugin User Flow 与 Installed List 防护

本轮补充了插件选择、已安装插件列表、用户配置、license refresh、第三方 OAuth 和 logout 的 client contract：

- select plugin 未授权：client 会先检查 CRM auth；未授权时提示用户去 user settings 连接 CRM，不打开 plugin configure page，并关闭 loading。
- select plugin 已授权：client 会从 Developer Console/manifest plugin list 中解析 `pluginId=access`，读取线上 user settings，拉取 plugin details，检查第三方 auth state 和 license status，然后注册并导航到 plugin configure page。
- installed plugin list：client 会用 user settings 里的 `plugin_*` 设置筛选已安装插件，批量补 license 状态，再注册 installed plugin list page；如果本地/服务端 settings 里存在 manifest 已删除的 stale plugin id，client 现在会跳过它，避免列表页崩溃。
- plugin configuration submit：client 会把表单 config 与 existing config 合并后写入 `plugin_${pluginId}` user setting，并附带 RingCentral account id，保存后返回上一页并提示成功。
- plugin license refresh：client 会重新查询 license status，用当前表单 config 重新生成 configure page，并在 widget 中覆盖注册该 page。
- plugin auth button：client 会向 plugin `authorizationUrl` 请求 auth URL，打开第三方 OAuth window，并缓存当前 formData，供回调后恢复配置页。
- plugin logout button：client 会把 CRM JWT 发给 plugin logout URL，重新查询 license status，生成 logged-out 的 configure page，并提示用户 logout 成功。

这批测试覆盖的是 client 对 Developer Console plugin metadata、user settings、plugin service、第三方 OAuth/logout endpoint 与 widget customized page 的编排。它不替代 server/plugin backend 的 license、register、logout 实现测试。


## 本轮补充：Plugin Provider License Contract

本轮补齐 server/core 对 plugin license provider 的直接 contract：

- `handlers/plugin.getPluginLicenseStatus` 在没有已安装 plugin account data 时返回 `null`，不访问外部 provider。
- 已安装 plugin 有 `licenseStatusUrl` 和保存的 plugin `jwtToken` 时，server 会用 `Authorization: Bearer {pluginJwt}` 调 provider license endpoint，并返回规范化后的 provider payload。
- provider license endpoint 返回缺少 `licenseStatus` 的非标准 body 时，`handlers/plugin.getPluginLicenseStatus` 会规范化为 `{ licenseStatus: false, licenseStatusDescription: "Plugin license status unavailable" }`，避免 client 收到 `{}` 或 `undefined` 后无法稳定渲染。`/plugin/licenseStatus` 在 provider 抛错或超时时不会返回 500，而是降级为 `{ licenseStatus: false, licenseStatusDescription: error.message }`，让 client 可以稳定显示 license invalid 状态。
- `/plugin/register` 遇到 provider/register handler 失败时返回 400 和 `{ successful: false, returnMessage }`，让 client admin install rollback 有稳定触发条件。
- `handlers/plugin.unregisterPluginAccount` 会删除对应 account/plugin 的持久化 `pluginData`，固定 `/plugin/unregister` 的核心副作用。

这些测试覆盖的是 server 与 plugin provider 的边界，不访问真实 plugin 服务，也不替代某个具体 plugin 的端到端验收。

## 本轮补充：Plugin Admin Flow 与 Google Sheets 配置流

本轮补充了 plugin admin 安装/卸载/配置，以及 user/admin Google Sheets 配置的 client contract：

- plugin admin install：client 会读取 Developer Console plugin list 和当前 admin settings，把 plugin metadata 写入 `plugin_${pluginId}` admin setting；隐藏配置字段会初始化为 `customizable=false`，普通字段可自定义。之后 client 会调用 server `/plugin/register`，带上 RC access token、plugin id/access/name 和 RC account id。
- plugin admin install rollback：如果 server register 失败，client 会把刚写入的 plugin admin setting 标记为 `isRemoved=true` 并再次上传，避免半安装状态留在 admin settings；随后显示错误通知并关闭 loading。
- plugin admin remove：client 会把目标 plugin 标记为 removed，调用 server `/plugin/unregister`，刷新 user settings 移除对应 key，然后返回并重建 installed plugin list page。
- plugin admin details submit：client 会从 `adminSettings` 中读取目标 plugin setting，把表单字段写回 `config`；`hiddenConfigFields` 中的字段会强制保存为 `customizable=false`，上传后返回上一页。
- user Google Sheets select：client 会缓存带 timestamp 的 pending selection，打开 server file picker；回调到达且 5 分钟内有效时，client 会写入 `googleSheetsName/googleSheetsUrl` user settings、清理 pending state、提示成功并重新注册 Google Sheets page。
- user Google Sheets create/remove：client 会调用 server 创建 sheet 或清空 user setting，然后重新注册并导航到 Google Sheets page。
- admin Google Sheets select/create：client 会保存 `forceGoogleSheets` 管理状态；当 admin 选择或创建 sheet 时，会写入 `adminSettings.userSettings.googleSheetsName/googleSheetsUrl`，并根据是否强制管理设置 `customizable`，上传 admin settings 后重建 admin page。
- admin Google Sheets remove：client 会清空 admin sheet 设置并恢复 `customizable=true`，同时刷新 user settings 清空用户侧 Google Sheets 配置，提示成功并重建 admin page。

这些测试覆盖的是 Chrome extension 对 plugin/Google Sheets 配置状态、server endpoint、Chrome storage、widget customized page 和通知的编排。不覆盖 Google Sheets API、server register/unregister/file picker 的真实网络行为。

## 本轮补充：User Mapping 与 Contact Search Buttons

本轮补充了 admin user mapping 和 call/message log contact search 入口的 client contract：

- reinitialize user mapping：client 会调用 admin `reinitializeUserMapping`，显示成功通知，并保证 loading 状态正确开关。
- user mapping edit：client 会从当前 page formData 的 `allUserMapping` 找到目标 CRM user，只保留 RingCentral User/Department 作为可选 extension，注册 edit user mapping page 并导航过去。
- user mapping remove：client 会把目标 `crmUserId` 的 `rcExtensionId` 清空，上传 admin settings，再重新拉取 server user mapping，注册并导航到 user mapping list page。
- edit user mapping submit：client 会把表单中的 `crmUserId` 和 `rcExtensionList` 写入 `adminSettings.userMappings`；已有记录会更新，空 extension list 会删除映射，新增 CRM user 会创建映射；保存后刷新 list page 并返回上一页。
- contact search call/message buttons：client 会从 log form 读取 `contactNameToSearch` 和 `contactPhoneNumber`，调用 custom contact search，分别注册 `contactSearchResultCallLog` 或 `contactSearchResultMessageLog` page，并导航到对应结果页。

这些测试覆盖的是 extension 对 admin settings、RingCentral user list、server mapping/search API、widget customized page 的编排。不覆盖 server 端如何生成 mapping，也不覆盖 CRM contact search 的真实网络结果。

## 本轮补充：Contact Search Result 与 Appointment InputChanged

本轮补充了 search result selection 和 appointment 页面输入变化的 client contract：

- call log contact search result：用户在搜索结果页选择 CRM contact 后，client 会把真实 contact 去掉 `isNewContact` 标记后加入 log page cache，并写入 `rc-crm-search-contact-{phone}` 缓存；随后重建 call log page，触发 contact match，更新 call log page，并先回到 `/history` 再回到原 call log path。
- message log contact search result：message log 选择结果走同样的缓存和回填逻辑，但更新的是 `rc-adapter-update-messages-log-page`，最终回到 `/log/messages/{conversationId}`。
- appointment date/time inputChanged：开始或结束时间变化时，client 会重新计算 ISO8601 duration；如果 endDateTime 缺失或早于 start，client 会把 endDateTime snap 到 start，并重新注册 create/edit appointment page。
- appointment participant autocomplete：当 attendee field 中出现非候选 ID 的 free-text 输入时，client 会用 CRM JWT 调 custom contact search，合并并去重候选联系人，把 free-text query 从 selected ids 中移除，并按 manifest 的 `emailMandatoryInAttendee` 规则重新渲染 appointment page。
- appointments list inputChanged：filter/tab 变化会立即显示 loading、刷新列表、导航回 appointments tab，并记录 `appointmentsLastState`；纯 search typing 会先立即响应 widget，再通过 debounce 刷新列表，避免输入过程中 spinner 影响用户体验。

这些测试覆盖的是 client 对 Chrome storage、custom contact search、appointment list/search state、widget page update/navigation 的编排。不验证 CRM search 或 appointment backend 的真实数据返回。

## 本轮补充：Customized Page InputChanged 页面流

本轮继续覆盖 widget customized page 的输入变化处理器。它们不是后端业务逻辑，而是 Chrome extension 根据 widget formData、Chrome storage 和 manifest 重新生成页面、触发导航或调用轻量 API 的客户端编排层：

- developer settings page：用户选择 implemented interface 时，client 会打开 Developer Portal 对应 interface 文档页。
- platform selection page：平台搜索输入会通过 debounce 重新读取 connector/platform list，并按 search/filter/selected platform 重新注册平台选择页。
- hostname input page：动态 hostname URL 输入会 debounce；client 按 manifest 的 URL wildcard 校验输入是否合法，并在 API-key managed auth 所需字段满足时显示 Connect readiness 文案。
- calldown page：callback 列表 search typing 走 debounce 且不显示 loading；filter 变化立即刷新列表、记录 last state，并显示 loading on/off。
- multi-contact prompt：搜索只刷新联系人候选弹窗；选择联系人会打开 CRM contact page，返回上一页，并恢复 ringing dialog。
- Google Sheets user/admin page：用户页根据当前 user settings 重建配置页；admin 强制 Google Sheets 设置时会同步 adminSettings 的 customizable 状态、上传 admin settings，并提示用户。
- user mapping input：mapping 列表搜索按 search/filter 重建列表；edit page 根据选择的 RingCentral extension 重新渲染编辑页。
- c2d schedule page：client 会清理过去时间、按 new/existing contact 控制字段显隐，并根据 callback 时间和新联系人姓名启用/禁用 submit。
- report page：admin 选择无效 RingCentral extension 时会在 fetch stats 前停止；普通用户刷新 user report tab 时会按账户 timezone 查询 stats 并重新注册 report page。
- unlogged call page：补了红绿循环。组件 schema 传入的 `record` 是 session id 字符串，旧实现用 `record.sessionId` 读取 cached note，导致 note lookup 用 `undefined`。现在 handler 会兼容 string/object 两种形态，使用规范化后的 session id 打开 call log page。

这批测试进一步明确了 client extension 的职责边界：它负责处理 widget 输入事件、保持本地状态、组合页面 render payload、调用已有 core/service API、发送 widget navigation/message；不测试 Developer Portal、CRM、Google Sheets 或 server 对应 endpoint 的真实实现。

## 本轮补充：Admin / Managed Customized Section InputChanged

本轮覆盖了 `/customizedPage/inputChanged` 下 admin section 切换和 managed-auth 页面重渲染。这里的 client 职责是把 widget 的 section/formData 变更转成新的 customized page，并在需要时读取 Chrome storage、admin core API、plugin catalog 或 RingCentral extension list：

- installed plugins admin section：client 会从 admin settings 中读取已安装 plugin，和当前 plugin catalog 做交集，跳过 catalog 中已经不存在的 stale plugin setting；随后批量查询 license status 并注册 admin installed plugin list page。本轮用红绿循环修复了 stale plugin 导致 `targetPlugin.requireLicense` 崩溃的问题。
- general settings section：client 会注册 general settings page 并导航到对应 customized page。
- managed settings section：client 会把当前 CRM platform manifest 传给 managed settings page render，并用 loading on/off 包裹页面切换。
- server-side logging section：client 会读取 server-side logging subscription、additional field values、implemented interfaces、user permissions，组合出 server-side logging settings page；是否支持 user mapping 由 `implementedInterfaces.getUserList` 决定。
- managed authentication section：client 会从 admin core 读取 managed auth settings，并根据 org/user fields 是否存在生成 managed authentication landing page。
- managed auth org section：client 会把 storage 中的 org fields/org values 和当前 formData 合并传给 org config page。
- managed auth user section/page：client 会过滤 RingCentral contact list，只保留 `User` 和 `Department`，并按 search/filter 重建 user managed auth list。
- managed auth user edit page：client 会按当前 `rcExtensionId` 找到目标 RingCentral extension，只重新注册 edit page，不触发额外导航。
- plugin admin settings page：client 会读取 selected plugin admin setting，拉取 plugin details，并重建 plugin admin detail page。
- plugins admin config section：client 会跳过已经不在 plugin catalog 中的 stale plugin setting，只把仍存在的 installed plugins 传给 plugins setting page。

这些测试仍然把边界放在 client extension：验证 storage/API 调用参数、page render payload、widget navigation/loading message；不验证 admin core、plugin catalog、RingCentral directory 或 server-side logging endpoint 的真实后端实现。

## 本轮补充：普通 Admin Settings Sections 与 Router 分发

本轮继续补齐 `/customizedPage/inputChanged` 中普通 admin settings section，以及两个 router 入口本身的行为。重点不是测试各 React page component 的 UI 细节，而是验证 Chrome extension 在 widget 事件边界上的编排：

- 普通 admin settings sections：click-to-dial matcher、widget settings、notification level、phone number format、click-to-dial embed、call/SMS logging、advanced features 都会读取 `adminSettings.userSettings`，生成对应 settings page，并导航到 `/customized/{pageId}`。
- customize tabs section：client 会把 `adminSettings.userSettings`、完整 manifest 和 platformName 一起传给 renderer，确保 tabs 配置按当前 CRM platform 生成。
- contact setting section：client 会根据 platform 名称和 `enableExtensionNumberLoggingSetting` 决定是否展示 overriding number format 和 extension number logging 配置。
- custom settings section：client 同时读取 admin user settings 和当前 user settings，并把 CRM manifest 交给 custom settings renderer，用于展示 managed/customizable 状态。
- call log details section：当 admin settings 声明 server-side logging 已启用时，client 会再次查询真实 subscription 状态，再把 user permissions 和 subscription lock 状态传给 call log details page。
- auto-log preferences section：当 connector 没有 contactTypes 时，client 会 fallback 到通用 `Contact` 类型，避免自动记录偏好页缺少 contact type 选项。
- appearance / managed OAuth section：覆盖无 storage 依赖的简单 page registration 和 navigation。
- Google Sheets admin config section：client 会先 refresh admin settings，再用最新 admin settings 渲染 admin Google Sheets page，并用 loading on/off 包裹。
- user mapping section：client 会从 server 拉取 CRM/RingCentral user mapping，压缩写入 `adminSettings.userMappings`，上传 admin settings，然后打开 user mapping page。
- `/customizedPage/inputChanged` router：覆盖了入口先 response widget，再按 page id/section 分发；plugin admin settings 会把 `formData.section` 作为 pluginId 传给 page handler；admin/managed plugins section 会分发到不同 handler；appointment create/edit 共用 appointment page handler。
- `/custom-button-click` router：覆盖 appointment tab hidden guard、support popup、clear platform info、license refresh、dynamic link button 和 sheet info link 等 inline 分支。

这批测试把 router/section 层的职责固定下来：response widget、防止超时、选择正确 handler、传递正确上下文、读取/写入 Chrome storage、打开外部链接或 service worker popup。后端 API 的真实响应、React component 的渲染细节和浏览器真实标签页行为仍不在这些单元测试里。

## 本轮补充：Top-level Notify Lifecycle Handlers

本轮开始覆盖 `src/eventHandlers/*.js` 顶层 notify handler。它们由 `popup.js` 按 widget `data.type` 分发，是 Chrome extension 在 RingCentral widget 生命周期中的运行时入口：

- dialer ready：当 widget dialer ready 时，client 会向 service worker 查询 cached Click-to-X intent；`c2d` 会回放为 `rc-adapter-new-call`，`c2sms` 会带本地 cached contact name 回放为 `rc-adapter-new-sms`，`c2schedule` 会强制刷新 contact match、生成 schedule page 并导航到该 page。
- side drawer open：client 会把 side drawer 打开/关闭状态转发给 service worker，供 popup/window lifecycle 使用。
- AI assistant settings：client 会把 widget 的 AI assistant 设置写回 user settings，并设置 `isAvoidForceChange=true`，避免 managed settings 覆盖用户刚触发的本地状态。
- phone number format settings：client 会持久化 format type/template，并按 widget readOnly 状态设置 `customizable`。
- analytics notify：WebRTC call ended 会读取 cached `callWith/callingMode`，清除 `hasOngoingCall`，并发送 call-end analytics payload；call init/start/ringout notify 分别映射 placed/answered/connected analytics。
- route changed：client 会记录当前 widget path，清理非 message 页面上的 auto-popup conversation cache；进入 Call Back tab 时，CRM 已连接则按 `All` filter 刷新 callback records，CRM 未连接则隐藏 Call Back tab。
- region settings：client 会保存 selected region，刷新 i18n locale，并重新注册 third-party service manifest 以刷新 UI 字符串。
- pushAdapterState：client 会 refresh manifest，应用 connector request timeout 到 axios defaults，并重新注册 third-party service manifest。
- login popup：client 会把 RingCentral OAuth URL 转发给 service worker 打开 OAuth window。
- telephony session：有 recording 时 client 会写 pending recording marker 并登记 pending session id；attended transfer on-hold 会写入 popupContext；warm transfer answered 会按 call-pop multi-match 设置打开 CRM contact page。
- auto-log notify：call auto-log 打开且 CRM 已认证时，client 会记录 analytics、初始化 retro auto call log retry counter，并启动定时补记 interval；message auto-log notify 只记录设置变更 analytics。
- webphone connected：client 会重新 check auth，并注册 feedback callback；用户点击 feedback 时会触发 `/custom-button-click` 的 support flow。

这些测试覆盖的是 extension 对 widget lifecycle、service worker、Chrome storage、analytics、contact/log 页面和 axios runtime config 的编排。它们不替代 RingCentral widget、service worker window 管理、CRM 后端或 analytics 后端的真实集成测试。

## 本轮补充：Active Call Notify

本轮继续覆盖 `rc-active-call-notify`，这是 client extension 最核心的实时电话事件入口之一。它的职责不是判断 CRM 业务数据是否正确，而是把 RingCentral widget 的 call event 转成 extension 本地状态、service worker 消息、call note 页面、call log 页面和 contact pop 行为：

- Inbound ringing：client 会写入 `hasOngoingCall=true`，向 service worker 发送 `incomingCallRinging`，并在用户设置为 `onFirstRing` 时打开匹配到的 CRM contact。
- Outbound connected：client 会打开 expandable call note，按 `onAnswer` 设置弹出联系人，并把 call log page 所需的 subject/note/contact/session 数据写入本地 cache。
- Final ended call：client 会关闭 incoming ringing 状态、终止 expandable note、上传 cached call note、读取 cached note，生成 call log page，执行 inbound/outbound 默认值填充，更新 widget log page，导航到 `/log/call/{sessionId}`，并触发 call logger match。
- Extension-only guard：当 `allowExtensionNumberLogging=false` 且通话号码是纯 extension number 时，client 会在 final 阶段提前响应 widget，不自动打开 call log page，也不触发 match，避免把内部 extension-only call 当作 CRM 电话日志。

这些测试固定的是 client extension 的可观察行为：Chrome storage key、runtime message、window/widget postMessage payload、call log cache 和 log page navigation。它们刻意不测试真实 telephony backend、CRM contact search 质量、note upload endpoint 或 React page render 细节。

## 本轮补充：Login Status Notify

本轮覆盖 `rc-login-status-notify`，这是 widget 登录态变化后 client extension 的总初始化入口。它把 RingCentral 登录态、CRM 授权态、platform manifest、user settings 和 analytics runtime 串起来：

- 首次 RingCentral 登录但还没有选择 CRM platform：client 会保存 widget features 到 `userPermissions`，结合 RingCentral extension feature 打开 `c2sms` 权限，注册 `rcLoginStatus=true`，把 `crmAuthed=false` 写入 storage，并打开 platform selection flow。
- CRM 已授权登录：client 会注册 report tab、Call Back tab、appointments placeholder tab，设置定时刷新 user settings、pending recording check 和 call log matcher check；随后刷新 admin settings、检查 plugin version、刷新 user settings/user info，并把 CRM 授权状态同步回 widget。
- Analytics identity：client 会用 RingCentral extension/account 信息调用 server-side RcAPI，缓存 `rcUserInfo`，执行 analytics `reset/identify/group`，并把 `rc-extension-id`、`rc-account-id`、`developer-author-name` 写入 axios 默认 header。
- RC logout guard：widget 第一次打开时可能发送一次误导性的 logout event，client 会先吸收第一次事件；后续真实 logout 才记录 logout analytics 并把 `rcLoginStatus=false` 写入 storage。
- Release notes：当 storage 中记录的 extension version 落后于 manifest version 时，client 会注册 release notes page、导航到该 customized page、更新本地版本号，并显示更新通知。

这些测试覆盖的是登录态事件带来的 client 编排结果：Chrome storage、widget postMessage、analytics identity、axios runtime header、页面注册和 settings sync 调用。它们不验证 RingCentral OAuth、CRM API、Developer Portal、release notes 页面 UI 或真实后台返回。

## 本轮补充：Message Logger InputChanged / Match

本轮补齐 `/messageLogger/inputChanged` 和 `/messageLogger/match` 两个轻量子入口：

- Message log inputChanged：当 widget message log form 变化时，client 会用最新 formData 生成 updated message log page，并通过 `rc-adapter-update-messages-log-page` 回写 widget。
- Custom contact search：当用户在 message log form 里选择 `searchContact` 时，client 会注册 custom contact search page，并导航到对应 customized page；搜索入口使用的是 `contactSearchAdapterButtonMessageLog`。
- Message log match：widget 请求 conversation log match 时，client 只读取本地 `rc-crm-conversation-log-{conversationLogId}` 缓存；非空缓存会回传 dummy match row，空对象或缺失缓存不会被当成已匹配日志。

这些测试固定的是 message log 页面的客户端即时更新、custom contact search 导航和本地 match cache 响应，不测试真实 CRM 搜索、真实 message log API 或 widget 表单组件渲染。

## 本轮补充：Contacts View / Plugin Marketplace / Navigation

本轮补齐几个此前主要只被 router 间接覆盖的用户可见入口：

- `/contacts/view`：client 会根据 `hasOngoingCall` 决定打开 CRM contact page 时是否传入固定 `contactId`。普通联系人查看会传入选中的 contact id；通话进行中则只传 phone/type 和 multi-match 行为，让 call pop 逻辑继续按当前通话上下文解析联系人。
- Plugin marketplace：client 会拉取线上 user settings 和 plugin catalog，过滤掉已经安装的 plugin，保留当前 search/filter 状态，注册 plugin market page 并导航过去，同时用 loading on/off 包裹页面切换。
- Developer settings navigation：client 会读取 `isAdmin` 后生成 developer settings page，并导航到 `/customized/developerSettingsPage`。
- Implemented interfaces navigation：client 会读取 storage 中的 `implementedInterfaces`，生成 implemented interfaces page，并导航到 `/customized/implementedInterfacesPage`。
- Documentation navigation：当 platform 提供 documentation URL 时，client 打开外部文档链接并记录 analytics page；当 URL 缺失时显示 warning notification，不打开外链。

这些测试进一步固定了 extension 对 widget 页面注册、外部链接、Chrome storage 和 contact pop 参数的编排边界；它们不测试 plugin catalog 后端、真实浏览器标签页打开结果或 Developer Portal 文档内容。

## 本轮补充：Call Later In Message

本轮用 TDD 补了 `callLaterInMessage` 的 outbound recipient 取号场景：

- 当 message resource 是 outbound 且 `to` 是单个对象 `{ phoneNumber }` 时，client 应发送 `chrome.runtime.sendMessage({ type: 'c2schedule', phoneNumber })`，打开 Click-to-Schedule flow。
- 旧实现把 `to.phoneNumber || to.length > 0 ? to[0].phoneNumber : undefined` 混在一个表达式里，`to.phoneNumber` 存在时仍会进入 `to[0]` 分支，导致对象形态取不到号码。现在代码显式区分数组和对象两种 `to` 形态。

这个测试覆盖的是 Chrome extension 从 message action 发起 call-back scheduling 的客户端取号逻辑，不涉及 calldown 后端创建 callback record。

## 本轮补充：Calldown 次级按钮与 Customized Banner

本轮继续补齐几个低耦合但用户可见的 custom-button handler：

- `saveTempNoteButton`：用户在临时 call note 页保存时，client 会先导航 `goBack`，再按 `sessionId` 把 note 写入 call note cache。这里验证的是 widget navigation 和本地 note cache，不涉及真实 call log 提交。
- `calldownActionText`：Call Back 列表里的 text action 会优先从 `calldownListCache` 找到目标 row 的号码并发送 `rc-adapter-new-sms`；如果缓存缺失，会 fallback 到 button `additionalInfo.phoneNumber`；如果两边都没有号码，则不向 widget 发送 SMS intent。
- `customizedBanner`：临时 webinar banner 被 dismiss 时只记录当天日期，不打开页面；log recording banner 被点击时会隐藏 banner、注册 log submission page 并导航到该 customized page。

这些测试进一步固定了 extension 在小型 UI handler 中的职责边界：读取 Chrome storage、发送 widget postMessage、缓存本地临时 note、避免无号码时发起错误 SMS intent。它们不测试真实 log recorder、短信发送后端或 widget banner 组件渲染。

## 本轮补充：Auth Buttons

本轮覆盖 API-key auth、managed OAuth setup 和 Insightly API key 帮助入口：

- `authPage`：API key 登录成功时，client 会写入 `crmAuthed=true`，更新 server-side call logging token，按 user settings 注册 report tab 和 Call Back tab；如果 server 返回 admin settings，还会注册 admin page 并用 JWT 认证 App Connect server。登录失败时只写入 `crmAuthed=false`，不注册任何 post-login page。
- `managedOAuthSetupPage`：client 会保存 pending OAuth credentials，提示用户这些凭证会在第一个用户成功连接 CRM 后保存，随后启动 connect flow 并导航 `goBack`。测试用红绿循环修复了成功路径重复发送 `rc-log-modal-loading-off` 的问题，现在 loading 由 `finally` 统一关闭一次。
- `insightlyGetApiKey`：client 会根据当前 platform hostname 打开 Insightly 的 `/Users/UserSettings` 页面，帮助用户找到 API key。

这些测试覆盖的是 extension 对认证按钮的客户端编排：storage 状态、post-login 页面注册、loading 状态、通知、OAuth pending values 和外部帮助链接。它们不测试真实 CRM API key、OAuth 授权服务器、admin settings 后端或浏览器实际新标签页行为。

## 本轮补充：Appointment Secondary Buttons

本轮补齐 appointments tab 里此前主要只有 router 间接覆盖的小按钮 handler：

- `appointmentRefreshList`：按当前 tab/search/filter 强制刷新 appointments list，并用 loading on/off 包裹刷新过程。
- `appointmentCancel`：按 list button item id 取消 appointment，透传 server return message，随后用原 tab/search/filter 刷新列表，并响应 widget。
- `appointmentSave`：编辑保存成功后显示成功通知，按 returnTab/returnSearch/returnFilter 刷新列表并导航回 appointments customized tab；保存失败时只显示后端返回的校验消息，不刷新列表。
- `appointmentOpenContact`：如果列表行直接提供 `contactUrl`，client 直接打开外部联系人页；如果有 attendee 列表和 contact page URL template，client 会在 hostname 为 `temp` 时先解析 hostname，再为每个 attendee 打开联系人 URL。
- `appointmentOpenAppointment`：client 会按 manifest appointment page template 解析 `{hostname}` 和 `{thirdPartyAppointmentId}` 后打开 appointment 页面；如果没有模板也没有 row URL，则显示 warning notification。

这些测试覆盖的是 client extension 对 appointment UI action 的编排：JWT 读取、list context 提取、列表刷新、外链 URL 解析、hostname fallback、widget postMessage 和 notification。它们不验证真实 appointment service、CRM appointment/contact 页面或 widget 列表组件渲染。

## 本轮补充：Managed OAuth Delete Button

本轮补齐 `deleteManagedOAuthAccount` 的直接行为测试：

- 删除成功时，client 会打开 loading，调用 admin core 删除 managed OAuth account，关闭 loading，显示成功通知，并导航 `goBack`。
- 删除失败时，client 会关闭 loading，显示失败通知，不触发 widget navigation，避免用户误以为账号已经删除。

这些测试覆盖的是 admin settings 小按钮的客户端编排和错误路径处理，不验证后端实际删除 OAuth account 的实现。

### Custom button 内联帮助链接

本轮继续收敛 `/custom-button-click` router 中没有委托到独立 handler 的内联导航分支。这些按钮属于 Chrome extension client 对 widget button event 的本地编排责任：client 读取当前 connector manifest/platform 配置，决定是否打开外部页面，并在处理完成后向 widget 返回 `ok`。

已覆盖行为：

- `openCommunityPageButton`：固定打开 App Connect community 页面，并使用新 tab target。
- `releaseNotes`：当当前 platform 提供 `releaseNotesUrl` 时打开该 URL；未配置时不打开窗口。
- `getSupport`：当当前 platform 提供 `getSupportUrl` 时打开该 URL；未配置时不打开窗口。
- `writeReview`：当当前 platform 提供 `writeReviewUrl` 时打开该 URL；未配置时不打开窗口。
- 所有这些内联按钮无论是否打开外部链接，都会向 widget request 回 `{ data: 'ok' }`，避免 widget 侧等待 pending response。

这些测试不验证外部页面是否真实可访问，也不验证浏览器 tab 创建细节；它们只锁定 client 在收到 widget button event 后的可观察职责：调用 `window.open` 的 URL/target，以及 widget response。
### Call logger view/match 边界

本轮补齐 `/callLogger` 下此前主要由父路由间接覆盖的两个子能力：`viewLog` 和 `/callLogger/match`。这两个 handler 仍然属于 client extension 的职责，因为它们把 widget 的 call log UI 状态、Chrome local storage、本地缓存 note、server log 查询结果和 CRM 页面打开行为串起来。

已覆盖行为：

- `viewLog`：当当前 platform 支持 `canOpenLogPage` 时，client 用 session 对应的 `logId`、hostname、matched entity 的 contact id/type 打开 CRM log deep link。
- `viewLog` fallback：当 platform 不支持 log deep link 时，client 改为打开 matched contact page，并透传用户配置中的 multi-contact match behavior。
- `/callLogger/match` 本地命中：本地 `rc-crm-call-log-{sessionId}` 已存在时，client 直接把该 session 作为 matched call log 返回，不访问 server。
- `/callLogger/match` server 命中：本地未命中时，client 查询 server call log；若 server 已匹配且本地有 cached note，会把 note 返回给 widget、更新 server log note，并把远端 matched log 缓存回 local storage。
- queue warning：queue call 被别人接听时，client 返回 failed status，避免 widget 把它当作可记录通话。
- one-time logging readiness：当 one-time logging 仍在等待 call log data ready 时，client 返回 `preparing data...` 状态，避免 UI 误显示为未匹配。

这些测试不验证 server log 查询实现、CRM deep link template 生成、真实 call recording 数据准备过程；它们锁定的是 client 在 widget match/view 请求中的编排结果和本地缓存副作用。
### Error logging inputChanged 页面

本轮补齐 error logging customized page 的 inputChanged 行为。此前已有 report issue、next step、start、submit 等 button handler 测试；这里补的是用户在 widget 表单里变更字段时，client 如何重新生成 customized page 并导航。

已覆盖行为：

- `getErrorLogRecordPage`：当 `issueDescription` 或 `errorLogRecordPageNextStepButton` 相关字段变化时，client 用当前 email 和 issue description 重新生成 step 1 页面，注册 customized page，并导航到该 page。
- `getErrorLogRecordPage` guard：只有无关字段如 email 变化时，不重新渲染、不发送 widget navigation。
- `logRecordSubmissionPage`：PII consent 变化时，client 用当前 `piiConsent` 重新生成 log record submission page，注册 customized page，并导航到该 page。

这些测试不验证 error log 收集、后端 submission 或页面组件渲染细节；它们锁定的是 client 对 widget inputChanged event 的响应边界。
### Pending recording cache 清理

本轮用 TDD 补了 `lib/logUtil.removePendingRecordingSessionId` 的直接测试。该函数负责在 call recording link 已经同步完成后，从 Chrome local storage 的 `pendingRecordings` 队列中移除对应 session，避免后续 login/status check 继续重复触发 recording sync。

红灯暴露的问题：旧实现使用 `pendingRecordings.filter(sessionId => sessionId !== sessionId)`，回调参数遮蔽了外层目标 session id，导致任何移除操作都会把整个 pending list 清空。

已修复行为：

- storage 中有 `['session-1', 'session-2', 'session-3']` 时，移除 `session-2` 后应保留 `['session-1', 'session-3']`。
- 该测试锁定的是 client 本地 pending recording queue 的最小缓存副作用，不验证真实 RingCentral recording API 或 server call log update。
### Custom contact search core adapter

本轮补齐 `core/customContactSearch` 的直接测试。这个模块是 call log、message log 和 appointment attendee 搜索联系人时复用的 client adapter：它负责生成 widget search page、调用 server custom contact search endpoint，并把结果转换成 widget customized page schema。

已覆盖行为：

- `getCustomContactSearch`：生成本地 search page，按调用方传入的 adapter button id 生成按钮字段，并保留 contact phone、appointment flag 和已有 formData。
- 普通 call/message search result：client 带本地 `rcUnifiedCrmExtJwt` 和搜索关键词调用 `/custom/contact/search`，把返回的 CRM contacts 转成 widget list page，并保留搜索词、电话号码和原始 contactInfo。
- appointment attendee search result：当 attendee email 必填时，client 会加入 warning admonition，把没有 email 的 contact 标记为 disabled，同时使用 checkbox list 和 Add submit 文案。
- 空结果：server 返回空 contact list 时，client 显示 server returnMessage notification，并不返回 customized page。

这些测试不验证真实 CRM contact search 质量或 server endpoint；它们锁定的是 Chrome extension client adapter 的 schema 生成、请求参数、email 必填约束和 notification 行为。
### Call disposition core adapter

本轮补齐 `core/disposition` 的直接测试。这个模块是 call log form、auto log 和 retro sync 中写回 CRM/server disposition 的 client core adapter。

已覆盖行为：

- 有 `rcUnifiedCrmExtJwt` 时，client 会向 `${serverUrl}/callDisposition` 发 PUT，body 包含 session id、dispositions、storage 中的 `rcAdditionalSubmission`，以及 RingCentral extension number。
- server 返回 `returnMessage` 时，client 会按 message type、message、ttl 和 details 显示 notification。
- 没有 CRM JWT 时，client 不调用 server，也不显示 disposition update notification。

这些测试不验证 server 如何保存 disposition；它们锁定的是 extension client 在本地 auth/context 存在时如何组装 update request，以及未授权时不会误写 server。
### API error handler auth recovery

本轮补齐 `lib/apiErrorHandler` 的直接测试。这个模块是 popup/runtime API 调用失败后的客户端恢复入口，负责识别 CRM auth 失效错误、清理本地 CRM auth cache、触发 analytics，并给用户明确提示。

已覆盖行为：

- 非 CRM auth required 错误不会触发本地 CRM auth 清理、analytics 或 notification。
- 当 response status 为 400 且 message/returnMessage/string body 包含 `authorize CRM platform` 时，client 会调用 `auth.clearLocalCrmAuthState()`；清理成功后触发 `trackCrmAuthFail()`、执行已注册的 cache cleared callback，并显示 `Please go to Settings and authorize CRM platform` warning notification。
- 同一类 CRM auth required 错误在 5 秒 throttle window 内重复出现时，不会重复清理 cache、重复埋点或重复通知。

这些测试不验证具体 API 请求或 OAuth 重新授权流程；它们锁定的是 extension client 在 server 明确提示 CRM 授权失效时的本地恢复和用户提示策略。
### logUtil 日志表单与 pending recording 补充

本轮继续补齐 `lib/logUtil` 中更靠近自动/手动日志共同入口的行为：

- `getLogPageFormData`：client 会把 platform manifest 中的 call log 默认设置合并进 log page form data，同时保留用户当前选择的联系人和通话上下文。
- `getLogConflictInfo`：当 auto-log 只能找到新建联系人占位项时，client 会返回 `Unknown contact` 冲突，避免自动写入不确定对象；当已匹配联系人且平台字段有唯一默认值时，client 会自动选择 additional submission 默认值。
- `addPendingRecordingSessionId`：pending recording queue 会去重写入，避免同一个 session 重复排队。
- `checkAndSyncPendingRecordings`：client 会向 RingCentral 查询 pending session 的 call log，已经有 recording link 的 session 会触发 call log sync，仍未有录音的 session 会继续留在队列中。

这些测试覆盖的是 extension 本地队列、表单默认值和 auto-log 冲突判断，不验证真实 RingCentral recording API 或 CRM 后端写入。

### logService 通话同步与历史自动补日志

本轮补齐 `service/logService` 的三个高优先级公开导出：

- `syncCallData` 有录音路径：client 会读取 cached note，把 recording link、download link、AI note、transcript、通话元数据、`telephonySessionId` 和 `rcAdditionalSubmission` 一起传给 log core。
- `syncCallData` 无录音路径：client 仍会同步 note、AI note、transcript 和通话元数据，但不会带 recording 字段，也不会提前依赖 RingCentral access token。这个红绿循环修复了旧实现无录音时也无条件读取 token 的风险。
- `forceCallLogMatcherCheck`：只有 CRM 已授权且 server-side logging 开启时，client 才读取前 10 条 unlogged calls，并向 widget 发送 `rc-adapter-trigger-call-logger-match`；未授权或未开启时不触发 RingCentral adapter 或 widget message。
- `retroAutoCallLog`：历史补日志在联系人已匹配、无冲突、已有 unmatched server log 时，会新增 call log、带上自动选择的 disposition，并在平台支持且不是 one-time log 时同步 disposition；无更多分页时会结束 interval 并发完成通知。

这些测试锁定的是 client 侧编排：Chrome storage、RingCentral adapter、contact/log/disposition core、widget message 和 notification。它们不验证后端如何保存 call log/disposition，也不验证 RingCentral 实际分页返回。

### rcAPI RingCentral API wrapper

本轮补齐 `lib/rcAPI` 的直接单元测试，覆盖被 user/admin/report flows 复用的 RingCentral wrapper 行为：

- `getInteropCode`：使用 RingCentral bearer token 和 client id 调用 interop generate-code endpoint，并返回 response code。
- `getRcCallLog`：按 date range 计算 `dateFrom/dateTo`，带 bearer token 分页读取 call log，并合并所有 page 的 records。
- `getRcSMSLog`：按用户选择的自定义日期范围分页读取 message-store，并合并 records。
- `getRcExtensionList`：分页读取 account extension list，只保留 `type === 'User'` 的 extension，映射 name、extensionNumber、email，并在同一个 `RcAPI` 实例内缓存结果，避免重复请求。

这些测试不访问真实 RingCentral API；它们锁定 URL、headers、分页停止条件、结果映射和实例缓存这些 client wrapper 契约。

### popup widget message 与 auth refresh 入口

本轮补齐 `popup.js` 顶层入口的两个 contract：

- widget 发来的 `rc-post-message-request` 会从 `window.message` listener 进入 `rc-post-message-request` router；log recorder 开启时，普通 request 会记录 action，但高频 `/callLogger/inputChanged` 不记录，避免日志录制被输入事件刷屏。
- `chrome.storage.local` 里的 `rcUnifiedCrmExtJwt` 或 `crmAuthed` 变化后，client 会重新同步 CRM auth 状态，并向 Embeddable adapter frame 重新注册 service manifest，让 widget 立刻看到最新授权能力。
- `chrome.runtime.onMessage` 下游 handler 抛错时，popup 会关闭 loading，且不会向 sender 误回 `ok`。

这些测试覆盖的是 popup 与 widget/runtime storage 的公开交界，不重复测试各个下游 handler 的业务分支。
### popup.js 恢复路径

`popup.js` 是启动脚本，包含大量 top-level side effect 和路由分发。为了先覆盖最高风险恢复路径，本轮用完整依赖 stub 加载 popup，并只验证可观察的错误恢复契约：

- message handler 抛 timeout 错误时，client 会向 window 连续发送 loading-off，显示 `Timeout` warning notification，不向 widget 发送 settings navigation。
- message handler 抛 401 CRM 授权错误时，client 会关闭 loading，显示后端返回的授权失效消息，并向 widget 发送 `rc-adapter-navigate-to /settings`，引导用户重新授权。

这些测试不尝试覆盖 popup 的所有 event/message 路由；大多数路由已经由各 handler 的直接测试覆盖。

### popup axios interceptor JWT 与 401 恢复

本轮补齐了 `popup.js` 顶层 axios interceptor 的关键 runtime contract。这个部分是 client extension 的职责，因为它发生在所有 server API 调用进入后端之前/之后，直接决定 CRM JWT 如何从 widget URL、storage、response header 和 401 错误中恢复。

已覆盖行为：

- request interceptor 会从 URL query 中提取 `jwtToken`，移除 URL 上的敏感 token，并写入 `Authorization: Bearer ...`。
- 当 URL 没有 token 时，request interceptor 会使用 `chrome.storage.local.rcUnifiedCrmExtJwt` 注入 Authorization header。
- 如果请求已有显式 `Authorization/authorization`，或配置了 `skipAuthorization`，client 不会覆盖调用方意图。
- response interceptor 会把成功 response header 里的 `x-refreshed-jwt-token` 持久化到 local storage。
- 401 API error 会先持久化 refreshed JWT，再交给 API error handler，并在非 `/unAuthorize`、非 `skipAuthorization`、且请求带 Authorization 时清理本地 CRM auth cache。
- `/unAuthorize` 和 `skipAuthorization` 的 401 不会清理本地 CRM auth cache，避免 logout/auth-check 类请求造成误登出。

这些测试不验证 server 如何签发或刷新 JWT；它们只锁定 client 在 API 边界的 token 注入、token 刷新持久化和 401 recovery guard。

### retroAutoCallLog 跳过、停止与冲突路径

本轮在已有 happy path 基础上补齐 `service/logService.retroAutoCallLog` 的负向路径。历史自动补日志是后台行为，错误触发会带来重复 API 调用、误写 CRM log 或无限 interval，因此这些 guard 属于高优先级 client coverage。

已覆盖行为：

- 当 `getEnableRetroCallLogSync(userSettings).value` 为 false 时，client 直接返回，不读取 unlogged calls、不修改 max attempt、不发通知。
- 当 `retroAutoCallLogMaxAttempt` 已耗尽时，client 停止存储中的 interval，并发送 `Historical call syncing finished. 0 call(s) synced.` 完成通知，不再读取 unlogged calls。
- 当历史通话已经 contact matched，但 `getLogConflictInfo` 返回 `hasConflict: true` 时，client 不读取 cached note、不查 server log、不执行 `addLog`，也不写 disposition。
- 当历史通话没有匹配到 CRM contact 时，client 不继续做 conflict check、server log 查询、`addLog` 或 disposition 写入；如果本轮没有更多分页，会停止 interval，并 dismiss 本轮刚创建的 notification id。
- 当 server 已返回 matched call log 时，client 不重复写 call log/disposition，而是向 widget 发送 `rc-adapter-trigger-call-logger-match`，让 widget 重新同步 matched 状态。
- 单次 `retroAutoCallLog` 执行最多自动写入 10 条成功日志；第 11 条及之后留给下一轮后台同步，避免一次 tick 处理过重。
- 冲突、未匹配和 batch limit 路径仍会消耗一次 max attempt，因为本轮 background sync 已执行过一次分页检查。

这些测试锁定的是 client orchestration：Chrome storage、RingCentral adapter、contact/log conflict 判断、widget matcher、interval 和 notification。它们不验证真实 RingCentral 分页，也不验证 CRM server 如何保存日志。

本轮红绿循环还修复了一个 notification 清理问题：当开始同步时还没有 `retroAutoCallLogNotificationId`，client 会创建新的 background sync notification；完成同步时必须 dismiss 这个新 id，而不是 dismiss 旧的 `null`。

### Developer Portal / Server contract test

本轮继续把 client 依赖的跨项目 contract 独立出来，优先覆盖会直接影响 extension 行为的接口：Developer Console plugin manifest、Developer Console connector/plugin catalog list、core server 的 implemented interfaces、managed auth/plugin routes，以及 async plugin callback 生命周期。

已覆盖行为：

- `test/contracts/developerConsolePublicApi.test.js` 直接加载 Developer Console 的 `connector.getManifest` handler，并用 `Connector.get` stub 避免真实 DynamoDB/local service。public plugin manifest 会按 `{ id, accountId: APPROVED }` 查询，并返回 `author`、`version`、`platforms[pluginName]`；client 的 `manifestService.getPluginDetails` 正是从这个 `platforms[selectedPlugin.name]` 里读取 plugin details。
- 同一个 contract test 覆盖 internal/shared/private plugin manifest：portal 必须使用 query 中的 `accountId` 查询，并保留 plugin manifest 里的 `endpointUrl`、`supportedLogTypes`、`phase`、`isAsync`、`pageContent` 等字段。这样可以保护 client plugin install/configure/license flow 对 Developer Console metadata 的消费。
- `getApprovedConnectors` 现在覆盖 public plugin catalog：`/public-api/connectors?type=plugin` 必须返回 `connectors` 数组，按 type 过滤，并且只暴露 catalog 必需字段，不泄露 `manifest` 或 `encodedSecretKey`。
- `getInternalConnectors` 现在覆盖 internal plugin catalog：`/public-api/connectors/internal?type=plugin&accountId=...` 必须从 `internal-plugins` cache 读取 shared plugins，同时返回 private plugins，并保持 `sharedConnectors/privateConnectors` 两个数组名。这个红绿循环修复了 portal 曾固定读取 `internal-connectors`，导致 shared plugin 对 client 不可见的问题。
- `rc-unified-crm-extension/packages/core/test/index.test.js` 新增 HTTP 层 `GET /implementedInterfaces` contract：oauth connector 返回完整 capability matrix 和 `getOauthInfo`，不返回 `getBasicAuth`；apiKey connector 返回 `getBasicAuth`、cache flag 和对应能力；缺少 `platform` 时返回 400 和 `Please provide platform.`。`rc-unified-crm-extension/packages/core/test/routes/managedAuthRoutes.test.js` 现在也覆盖 `/admin/managedAuth` GET/POST：server 必须用 CRM JWT 找到 CRM platform，用 `validateAdminRole` 得到 validated RC account，再读写 org/user managed auth values。`rc-unified-crm-extension/packages/core/test/routes/pluginRoutes.test.js` 覆盖 plugin backend route：`/plugin/register` 和 `/plugin/unregister` 必须验证 admin role、防止 `rcAccountId` spoofing，并调用 plugin handler；`/plugin/licenseStatus` 必须要求 CRM user session 后再读取 plugin license status。
- `rc-unified-crm-extension/packages/core/test/handlers/log.test.js` 现在覆盖 async plugin callback 的核心生命周期：成功 callback 会把 plugin note append 到既有 call log 并删除 task cache；插件主动返回失败会把 task cache 标记为 failed；过期 task 会被清理并返回 404；CRM 更新失败会保留 task cache、标记 failed 并把错误返回给 callback caller；缺少 `successful` boolean 时返回 400。

这些测试分别放在最接近 contract 归属的位置：Developer Console manifest/catalog contract 放在 client 的 `test/contracts` 下，原因是它直接服务于 extension 消费方，并且不依赖 portal 集成测试环境；core server contract 放在 core 包自己的 router test 下，原因是它验证真实 Express route 输出，而不是 registry 内部实现。

### Connector Catalog Consumption Contract

本轮补齐 extension `getPlatformList` 依赖的 Developer Console CRM connector catalog contract。这里的 client 责任是完整消费 public/shared/private CRM connector 列表，并只依赖 catalog 必需字段；Developer Console 责任是按 `type=connector` 过滤，返回 public approved connectors 和 account-scoped internal connectors，同时不把 manifest、secret 等编辑/服务端字段泄露到 catalog response。

已覆盖行为：

- public connector catalog `/public-api/connectors?type=connector` 只返回 approved CRM connectors，不混入 plugin，并只暴露 extension platform selection 需要的 catalog 字段。
- internal connector catalog `/public-api/connectors/internal?type=connector&accountId=...` 必须从 `internal-connectors` cache 读取 shared connectors，同时返回当前账号 private connectors；shared/private arrays 均按 `type=connector` 过滤，不泄露 `manifest` 或 `encodedSecretKey`。
- 这组 contract 和 `manifestService.getPlatformList` 的 unit test 对齐：client 先取 public connectors，再取 internal shared/private connectors，并给每项加 `access` 标签。
### Connector Manifest Consumption Contract

本轮继续补齐 extension 选择 CRM connector 时依赖的 Developer Console manifest contract。这里的 client 责任是：根据 platform catalog item 的 access scope 组装正确 manifest URL，保存 manifest URL 供后续 refresh 使用，并消费 Developer Console 返回的 `{ serverUrl, redirectUri, author, version, platforms }` wrapper。

已覆盖行为：

- public connector manifest 必须从 approved partition 读取，并返回 `serverUrl`、`redirectUri`、`author`、`version`，以及以 connector `name` 为 key 的 `platforms` manifest；catalog/private 字段如 `encodedSecretKey` 不属于 client 可消费的 manifest contract。
- proxy connector manifest 必须把 `proxyId` 合并进对应 platform manifest，让 extension 后续 API 调用能走 core proxy connector。
- shared connector selection 必须用 catalog item 上的 owner `accountId` 请求 `?access=internal&type=connector&accountId={ownerAccountId}`，并在本地 `platform-info` 中标记 `isPrivate: true`。这和 private connector 使用当前 RingCentral accountId 不同，避免 shared connector 被错误当成当前账号私有 connector 拉取。
### Catalog Pagination Contract

本轮继续补齐 Developer Console catalog 分页 contract。这个风险属于 client extension 的职责边界：extension 的 platform selection 和 plugin market list 并不拥有 connector/plugin catalog 数据，但必须完整消费 Developer Console 暴露的 public catalog，否则当 approved connector 或 plugin 超过第一页时，用户会在 extension 中看不到后续 CRM 或 plugin。

已覆盖行为：

- `manifestService.getPlatformList` 会跟随 public connector catalog 的 `nextPageToken`，取完所有 public connectors 后，再合并 shared/private connectors，并保持 `access: public/shared/private` 标签。
- `manifestService.getPluginList` 会跟随 public plugin catalog 的 `nextPageToken`，取完所有 public plugins 后，再合并 shared/private plugins，并保持 plugin market list 依赖的 access 标签。
- Developer Console public `/public-api/connectors?type=connector&pageToken=...` 是无登录 public route；pagination 起点必须使用 approved partition，而不能读取 `req.currentUser.accountId`。这个 contract 保护 client 后续请求第二页 public catalog 时不会因为无用户 session 失败。

这个补充不改变 internal/shared/private catalog 的分页边界：当前 client 仍消费 Developer Console 返回的 `sharedConnectors/privateConnectors` 数组；如果 portal 后续给 internal route 增加 `nextPageToken`，再用同样方式扩展 internal catalog pagination。
### Plugin Details 与 Manifest Refresh Contract

本轮继续收紧 `manifestService` 的直接 client contract。这里的职责边界是：extension 不拥有 plugin/connector manifest 数据，但必须根据 Developer Console catalog item 的 `access` scope 组装正确 manifest URL，并在 widget push adapter state 时刷新或复用可用 manifest，避免把本地 manifest 对象当成远端 URL。

计划覆盖行为：

- `getPluginDetails` 对 public plugin 使用 approved public manifest URL：`/public-api/connectors/{id}/manifest?type=plugin`，并只返回 `platforms[selectedPlugin.name]` 中的 plugin details。
- `getPluginDetails` 对 shared plugin 使用 catalog item owner `accountId`：`?access=internal&type=plugin&accountId={selectedPlugin.accountId}`，不能误用当前 RingCentral accountId。
- `getPluginDetails` 对 private plugin 使用当前 RingCentral account id：`?access=internal&type=plugin&accountId={rcAccountId}`。
- `refreshManifest` 在存在 `manifestUrl` 时从该 URL 拉取最新 manifest，复用 `saveManifest` 的 override/persist 行为，并返回刷新后的 manifest。
- `refreshManifest` 在没有 `manifestUrl`、但已有本地 `customCrmManifest` object 时应安全返回并持久化该 manifest，不应发起 `axios.get(customCrmManifestObject)`；这个路径保护 `rc-adapter-pushAdapterState` 在旧 storage 或离线 fallback 状态下不崩溃。已通过 RED/GREEN 修复：只有 legacy string 才会作为 manifest URL 迁移，本地 manifest object 会复用 `saveManifest` 应用 override。
### Easy Coverage Batch: Client Lib Helpers

本轮按“低模糊度、可直接表达行为”的原则继续补 client coverage，先覆盖四个基础模块：

- `lib/appointmentUtils`：负责把 appointment/attendee 的多来源输入标准化为 client 后续页面和 handler 可消费的 canonical shape。测试只验证公开函数输出，不绑定调用方 UI 结构。
- `lib/logRecorder`：负责 error logging 的录制状态、axios debug header、widget banner、API request/response 摘要、上传 report、本地下载和上传后清理。测试覆盖 Chrome storage、axios URL/body/header 和下载 side effect，不访问真实 server。
- `lib/util`：负责通用 client helper 的稳定边界，包括 notification level gating、widget response message、debounce、callback contact cache 和 RingCentral additional submission 提取。测试覆盖公开 helper 的输入输出和 Chrome/widget side effect，不把断言写到调用方页面内部。
- `lib/analytics`：负责 mixpanel analytics 的启停、identify/group 和事件上下文。测试覆盖 token 缺失或 init 失败时的 no-op，以及 identify 后 CRM 事件必须带上当前 platform。

计划覆盖行为：

- attendee normalization 会接受 `{ id/name/type }`、`{ const/title/contactType }` 和 string id，过滤空值并 trim 字段。
- canonical appointment 会优先使用有效 `thirdPartyAppointmentId`，当其为 `N/A` 时 fallback 到 `id/externalId`，并从 attendees 生成 participant summary。
- list context extraction 会从 button/page/formData 的不同嵌套位置读取 tab/search/filter，并提供稳定默认值。
- log recording start 会初始化内存 log、设置 `errorLogRecordingStatus=recording`、打开 axios debug header，并向 widget 注册 recording banner。
- upload success/failure 都会下载当前 report 并清理内存 log；success 还会向 server 获取 presigned URL，再以 `skipAuthorization` 上传 JSON。
- util helpers 会把秒数格式化为 duration string，按 notification level 过滤提示，向 Embeddable iframe 回写 response，只执行同一 debounce key 的最后一次请求，缓存完整 callback contact，并在 `rcAdditionalSubmission` path 缺失时跳过而不是中断 auth/login flow。
- analytics 在没有 `MIXPANEL_TOKEN` 或 mixpanel init 失败时保持 no-op；启用后 `identify` 会把 CRM platform 保存为后续 CRM analytics 事件上下文。
### i18n Helper Contract

本轮继续处理低模糊度 helper：`src/i18n/index.js`。client 在这里的职责是把 RingCentral region country code 转成 extension locale，加载对应 translation，并在启动时从 Chrome storage 恢复用户 locale。测试只覆盖 i18n public API，不逐条校验 locale JSON 文案，也不测试真实 RingCentral widget locale selector。

计划覆盖行为：

- `countryToLocale` 会把已支持国家码映射到对应 locale，未知国家码 fallback 到 `en-US`。
- `init`/`setLocale` 会加载 translation，`t` 支持 nested key、missing key fallback 和 `{param}` interpolation。
- `restoreLocale` 优先使用新 storage key `selectedRegion`；如果旧版本只保存了 `currentLocale`，仍应恢复该 locale，避免升级后退回默认英文。
### Small Page Builder Contract

本轮继续覆盖少量稳定 `components/*` page builder。这里的 client 职责是把 manifest/page config 转成 Embeddable customized page schema；测试只断言产品 contract 字段，不做整页 snapshot，避免 UI 排版变动造成脆弱测试。

计划覆盖行为：

- `supportPage` 会显示 service status、version、RingCentral account id，并只在平台声明 `supportReportIssue` 时暴露 report issue button。
- `feedbackPage` 会把 connector feedback config 转成 string/input/selection schema，保留 required 字段，并把 extension version 放进 hidden form data。
- `managedOAuthMissingPage` 会显示 admin-managed OAuth 缺失提示，并隐藏 submit button。
- `managedOAuthSetupPage` 会渲染 admin-managed OAuth 必填字段，支持 setup notes，并用 pending values 覆盖默认 redirect URI。
### Bullhorn Provider Helper Contract

`misc/bullhorn.js` 是 provider-specific helper，不测试 Bullhorn 真实 loginInfo 服务或 OAuth 页面。可覆盖的 client contract 是：在已有 Bullhorn URL cache 时直接组装 OAuth URL；cache 缺失时用保存的 Bullhorn username 请求 loginInfo、缓存返回的 URL，再通过 service worker 打开第三方授权窗口。

计划覆盖行为：

- `tryConnectToBullhorn` 使用 cached `crm_extension_bullhorn_user_urls.oauthUrl` 时不会请求远端 loginInfo，并会发送 `openThirdPartyAuthWindow` runtime message。
- cache 缺失时，client 会提示用户刷新 Bullhorn 页面，按 `crm_extension_bullhornUsername` 请求 Bullhorn loginInfo，持久化返回 URL，再发送同样的 auth window message。
### Diagnostic Page Builder Contract

本轮继续覆盖诊断/开发者类 page builder。client 在这些模块里的职责是把状态和用户输入转换成 Embeddable customized page schema；测试只验证稳定页面 contract，不锁定完整 UI snapshot。

计划覆盖行为：

- `implementedInterfacesPage` 会把 server capability map 转成 list options，并显示 implemented/not implemented meta。
- `developerSettingsPage` 会为所有用户暴露清理平台信息和查看 interface implementation 的入口，只有 admin 才暴露 reinitialize user mapping。
- `errorLogRecordPage` 会按 step 渲染错误描述、录制说明和录制中状态，且 issue description 为空时禁用下一步。
- `logRecordSubmissionPage` 会要求用户勾选 PII consent 后才能提交 error report。
- `tempLogNotePage` 会把 cached note 和 session id 放进 form data，用于 one-time log 等待期间临时保存 note。
### Catalog And Plugin Page Builder Contract

本轮继续覆盖 catalog/plugin 类 page builder。client 在这里的职责是把 Developer Console 返回的 connector/plugin catalog item、插件安装状态、license 状态和 plugin pageContent 转成 Embeddable page schema；测试不访问 Developer Console，也不验证真实插件后端。

计划覆盖行为：

- `platformSelectionPage` 会按 search/filter 过滤平台列表，显示 access meta，并把 selected platform/search/filter 写入 form data。
- `pluginMarketListPage` 会按 search/filter 过滤插件列表，并为每个插件提供 install/select action。
- `installedPluginListPage` 会显示已安装插件，admin 入口提供 explore submit，缺 license 的插件显示 warning iconMeta，空列表显示 helper text。
- `pluginConfigurePage` 会根据 plugin `pageContent` 生成配置 schema，跳过 hidden field，处理 required/readOnly、single/multi selection、auth/logout button 和 license refresh 状态。
- `pluginAdminConfigurePage` 会根据安装状态显示 install/uninstall admin action。
### 当前高优先级收敛状态更新

截至本轮，高优先级 coverage 已经覆盖四类风险：

- client 内部高风险编排：popup `window.message` 到 `rc-post-message-request` router 的入口、storage auth change 后 service manifest 重新注册、runtime message handler 失败恢复、popup axios interceptor 的 JWT 注入、刷新持久化、401 auth recovery guard，以及 `retroAutoCallLog` 的关闭同步、max attempt 耗尽、冲突跳过、联系人未匹配、server log 已 matched、`effectiveTotal` 截断路径。
- Developer Console plugin manifest 与 catalog contract：public/internal plugin manifest 的 lookup key、response wrapper、plugin metadata 字段，以及 public/internal plugin catalog 的数组名、type filter 和 shared/private 分类已经有 contract test。
- Server core capability、managed auth、plugin route/provider 与 async plugin callback contract：`/implementedInterfaces`、`/admin/managedAuth`、`/plugin/register`、`/plugin/unregister`、`/plugin/licenseStatus` 的关键 HTTP 返回形状、身份校验、handler 参数、plugin register 失败响应、license provider bearer token、provider error 降级、非标准 license response normalization 和 unregister 持久化清理已经有 test；async callback 的成功、失败、过期、CRM 更新失败和非法 payload 已有 handler test。
- Extension package smoke 与最小浏览器 E2E：`test/extensionPackage.test.js` 验证 `public/manifest.json` 的 Manifest V3、service worker、content script、web accessible resources、externally connectable、权限和图标声明，并确认 `build.js` entry points、popup scripts、options page、`c2d` 与 `embeddable` 静态资源能共同产出 Chrome unpacked extension 所需入口；`e2e/browserSmoke.test.js` 通过 `npm run test:e2e` 启动本机 Chrome/Edge，加载 `dist` unpacked extension，确认 MV3 service worker 出现、popup shell 可打开，在真实 popup 中预置 manifest storage 后请求本地 server `/implementedInterfaces?platform=...` 并持久化结果，在本地 HTTP CRM 测试页验证 built content script 能注入 quick access root，验证 C2D Call action 能从页面内 widget 事件进入 service worker、打开 extension popup，Pipedrive direct-page callback 会从 content script 进入 service worker/popup 并调用 server `/oauth-callback` 后写入 CRM auth storage、通知安装页完成，并验证手动 call log 创建会从 popup 发出带正确业务数据的 server `/callLog` POST，手动 message log 创建会发出 `/messageLog` POST 并在 server 成功后缓存 conversation log 状态，appointment confirm action 会发出 `/appointments/{appointmentId}/confirm` 并刷新 `/appointments` list，appointment create submit 会发出 `/appointments` POST 并用 `forceSync=true` 刷新 `/appointments` return list，appointment edit submit 会发出 `/appointments/{appointmentId}` PATCH 并用 `forceSync=false` 刷新 `/appointments` return list，admin plugin install action 会保存 admin plugin setting 并调用 `/plugin/register`，plugin auth action 会请求 plugin authorization URL、打开第三方 OAuth target 并缓存配置表单，plugin logout action 会向 plugin logout URL 发送 CRM JWT 并刷新 `/plugin/licenseStatus`，plugin configuration submit 会把 page-generated `logTypes` 映射为 `supportedLogTypes` 后保存到 `/user/settings`。

验证状态（2026-06-30）：

- client `npm test`：333 tests passed。
- client `npm run build`：成功产出 `dist` unpacked extension，build datetime `6/30/2026, 11:45:32 AM`。
- client `npm run test:e2e`：14 tests passed，覆盖 built extension/popup/local server implemented-interfaces request/content script/C2D/Pipedrive direct-page callback browser smoke，已有 contact 手动 call log/message log 创建的 `/callLog`、`/messageLog` server request contract，appointment confirm 的 `/appointments/{appointmentId}/confirm` + `/appointments` list refresh contract，appointment create 的 `/appointments` POST + `forceSync=true` `/appointments` list refresh contract，appointment edit 的 `/appointments/{appointmentId}` PATCH + `forceSync=false` `/appointments` list refresh contract，admin plugin install 的 `/admin/settings` + `/plugin/register` contract，plugin auth 的 authorization URL request + third-party OAuth target + `cachedPluginConfigFormData` contract，plugin logout 的 `logoutUrl` CRM JWT POST + `/plugin/licenseStatus` refresh contract，Pipedrive direct-page callback 的 `/oauth-callback` token exchange + CRM auth storage + setup completion notification contract，以及 plugin config submit 的 `/user/settings` contract；运行后没有发现 `app-connect-e2e-*` Chrome/Edge 进程残留。
- client targeted contract：`node --test test/service/manifestService.test.js` 9 tests passed；`node --test test/contracts/developerConsolePublicApi.test.js` 8 tests passed；`node --test test/eventHandlers/selectPlatform.test.js` 5 tests passed；`node --test test/lib/analytics.test.js test/lib/appointmentUtils.test.js test/lib/logRecorder.test.js test/lib/util.test.js` 16 tests passed；`node --test test/i18n.test.js` 4 tests passed；`node --test test/components/pageBuilders.test.js` 4 tests passed；`node --test test/misc/bullhorn.test.js` 2 tests passed；`node --test test/components/diagnosticPageBuilders.test.js` 5 tests passed；`node --test test/components/catalogPluginPageBuilders.test.js` 6 tests passed；`node --test test/eventHandlers/pluginButtons.test.js` 7 tests passed；`node --test test/messageHandlers/platformRuntime.test.js` 5 tests passed。
- core `npm test -- --runInBand --silent --coverage=false`：39 suites / 690 tests passed；server aggregate `npm test -- --runInBand --silent --coverage=false`：root 15 suites / 652 tests + core 39 suites / 690 tests，total 54 suites / 1342 tests passed。
- Developer Console targeted Jest：`npm test -- test/connector.test.js -t "GET /public-api/connectors" --runInBand` 已恢复，16 tests passed，覆盖 public/internal connector catalog 与 manifest route；Developer Console full `npm test -- --runInBand`：6 suites / 197 tests passed。此前超时原因是 `test/setup.js` 的 DynamoDB Local readiness probe 没有失败上限，timeout 后会留下 Jest 进程；现在 setup 对 launch/readiness 加了 15s 上限并 drain child stdout。
### 剩余 Coverage 分流

#### 1. 低模糊度，已完成本批覆盖

- `i18n/index.js`：已覆盖 country-to-locale mapping、unsupported country fallback、translation loading、missing key fallback、param interpolation、`selectedRegion` restore，以及 legacy `currentLocale` restore。RED/GREEN 修复了旧 locale cache 升级后回到 `en-US` 的兼容问题。
- `components/*` 小 page builder：已覆盖 `supportPage`、`feedbackPage`、`managedOAuthMissingPage`、`managedOAuthSetupPage` 的关键 schema/formData/UI intent，不做整页 snapshot。
- `misc/bullhorn.js`：已覆盖 `tryConnectToBullhorn` 在 cached Bullhorn OAuth URL 和缺失 cache 需要 loginInfo 两条路径下的 URL 组装、notification、storage 和 runtime message。
- 诊断/开发者 page builder：已覆盖 `implementedInterfacesPage`、`developerSettingsPage`、`errorLogRecordPage`、`logRecordSubmissionPage`、`tempLogNotePage` 的关键 schema/formData/UI intent。
- Catalog/plugin page builder：已覆盖 `platformSelectionPage`、`pluginMarketListPage`、`installedPluginListPage`、`pluginConfigurePage`、`pluginAdminConfigurePage` 的 filtering、actions、license 状态、config schema 和 form data merge。

下一批如果继续低模糊度单元测试，应换到新的候选模块，不再重复这些已覆盖 page/helper contract。

#### 2. 重要但需要业务澄清后再写

- 下一条真实 Embeddable/full widget E2E：call log、message log 创建、appointment confirm、appointment create、appointment edit、admin plugin install、plugin auth、plugin logout、Pipedrive direct-page callback 和 plugin config submit 已经有最小 browser contract；如果要继续做 provider-specific callback browser E2E，建议选择另一个 provider 的明确业务路径，避免重复已有 handler/core/Pipedrive 测试。
- 特定 CRM/provider callback note 格式：server/core 已覆盖通用 plugin callback 生命周期；如果要覆盖 Salesforce/HubSpot/Google Sheets 等差异，需要你确认每个 provider 的 note body、HTML/Markdown、字段映射和失败提示期望。
- 大型 customized page schema：很多 admin/report/plugin 页面可以测试，但如果只做全量 object snapshot 会很脆。需要确认哪些字段是产品 contract，哪些只是 UI 排版实现。
- Managed auth / server-side logging 的边缘优先级：已有核心 org/user/admin 流程测试；剩余如 org value 与 user value 冲突、disabled field 清理、部分字段继承规则，需要确认期望优先级。
- 更深的 hover/range matching 浏览器行为：当前 browser smoke 已证明 built extension/content script/C2D action 链路；真实网页选择范围、shadow DOM 变体和 hover 行为稳定性较差，需要先定义目标 CRM 页面 fixture 和可接受的 headless 稳定性。

当前建议顺序：低模糊度 helper/page-builder/Bullhorn 这一批已收敛。如果继续单元测试，可挑更大但仍稳定的 page builder、provider helper 或 auth/settings guard；如果继续高价值 E2E，优先选择另一个 provider callback 的明确业务路径，再按本轮 call/message/appointment/plugin 的方式只断言跨边界 request/response contract。
