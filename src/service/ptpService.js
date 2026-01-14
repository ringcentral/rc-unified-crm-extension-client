import axios from 'axios';
import { getManifest } from './manifestService';
import { showNotification } from '../lib/util';

async function upsertPTPAsyncTaskIds({ taskIds }) {
    const { ptpAsyncTaskIds } = await chrome.storage.local.get({ ptpAsyncTaskIds: [] });
    ptpAsyncTaskIds.push(...taskIds);
    await chrome.storage.local.set({ ptpAsyncTaskIds });
}

async function getPTPAsyncTaskIds() {
    const { ptpAsyncTaskIds } = await chrome.storage.local.get({ ptpAsyncTaskIds: [] });
    return ptpAsyncTaskIds;
}

async function removePTPAsyncTasks({ tasks, missingTaskIds }) {
    const completedTasks = tasks.filter(task => task.status === 'completed');
    const completedTaskIds = completedTasks.map(task => task.id);
    const failedTaskIds = tasks.filter(task => task.status === 'failed').map(task => task.id);
    const toBeRemovedTaskIds = [...completedTaskIds, ...failedTaskIds, ...missingTaskIds];
    const { ptpAsyncTaskIds } = await chrome.storage.local.get({ ptpAsyncTaskIds: [] });
    const newPtpAsyncTaskIds = ptpAsyncTaskIds.filter(taskId => !toBeRemovedTaskIds.includes(taskId));
    await chrome.storage.local.set({ ptpAsyncTaskIds: newPtpAsyncTaskIds });
}

// check PTP async task every 5 minutes
function setPTPAsyncTaskCheck() {
    const ptpAsyncTaskCheck = setInterval(async () => {
        const { rcUnifiedCrmExtJwt } = await chrome.storage.local.get('rcUnifiedCrmExtJwt');
        const manifest = await getManifest();
        const ptpAsyncTaskIds = await getPTPAsyncTaskIds();
        const ptpTaskRes = await axios.post(`${manifest.serverUrl}/ptpAsyncTask?jwtToken=${rcUnifiedCrmExtJwt}`, {
            asyncTaskIds: ptpAsyncTaskIds
        });
        if (ptpTaskRes.data?.tasks?.length === 0) {
            await removePTPAsyncTasks({ tasks: [], missingTaskIds: ptpAsyncTaskIds });
            return;
        }
        let notificationMessage = '';
        const ptpNamesAndStatus = [];
        for (const task of ptpTaskRes.data.tasks) {
            const ptpName = task.cacheKey.split('-')[1];
            const taskStatus = task.status;
            ptpNamesAndStatus.push({ ptpName, taskStatus });
        }
        const distinctPtpNames = [...new Set(ptpNamesAndStatus.map(item => item.ptpName))];
        for (const ptpName of distinctPtpNames) {
            const ptpTasks = ptpNamesAndStatus.filter(item => item.ptpName === ptpName);
            notificationMessage += `${ptpName}: `;
            const distinceStatus = [...new Set(ptpTasks.map(item => item.taskStatus))];
            for (const status of distinceStatus) {
                notificationMessage += `${status}(${ptpTasks.filter(item => item.taskStatus === status).length}) `;
            }
            notificationMessage += '\n';
        }
        const missingTaskIds = ptpAsyncTaskIds.filter(taskId => !ptpTaskRes.data.tasks.some(task => task.id === taskId));
        await removePTPAsyncTasks({ tasks: ptpTaskRes.data.tasks, missingTaskIds });
        if (notificationMessage !== '') {
            showNotification({ level: 'success', message: notificationMessage, ttl: 3000 });
        }
        // }, 5 * 60 * 1000);
    }, 1 * 60 * 1000);
    return ptpAsyncTaskCheck;
}

exports.upsertPTPAsyncTaskIds = upsertPTPAsyncTaskIds;
exports.getPTPAsyncTaskIds = getPTPAsyncTaskIds;
exports.setPTPAsyncTaskCheck = setPTPAsyncTaskCheck;