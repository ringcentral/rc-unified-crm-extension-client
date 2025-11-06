async function onEvent({ data, manifest, platformInfo, platformName, platform }) {
    // TODO: re-do errors
    const errorLogFileName = "[RingCentral App Connect]ErrorLogs.txt";
    // const errorLogFileContent = JSON.stringify(errorLogs);
    // downloadTextFile({ filename: errorLogFileName, text: errorLogFileContent });
}

exports.onEvent = onEvent;