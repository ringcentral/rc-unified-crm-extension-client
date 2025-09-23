import axios from 'axios';

async function getUserInfo({ serverUrl, extensionId, accountId }) {
    const userInfoHashResponse = await axios.get(
        `${serverUrl}/userInfoHash?extensionId=${extensionId}&accountId=${accountId}`
    );
    return userInfoHashResponse.data;
}

async function getInteropCode({ rcAccessToken, rcClientId }) {
    const rcInteropCodeResp = await axios.post(
        'https://platform.ringcentral.com/restapi/v1.0/interop/generate-code',
        {
            clientId: rcClientId
        },
        {
            headers: {
                Authorization: `Bearer ${rcAccessToken}`
            }
        }
    );
    return rcInteropCodeResp.data.code;
}

async function getRcCallLog({ rcAccessToken, dateRange, customStartDate, customEndDate }) {
    let startDate = '';
    let endDate = new Date(Date.now()).toISOString();
    switch (dateRange) {
        case 'Last 24 hours':
            startDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
            break;
        case 'Last 7 days':
            startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
            break;
        case 'Last 30 days':
            startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
            break;
        case 'Select date range...':
            startDate = customStartDate;
            endDate = customEndDate;
            break;
    }
    let pageStart = 1;
    let isFinalPage = false;
    let callLogResponse = null;
    let result = { records: [] };
    while (!isFinalPage) {
        callLogResponse = await axios.get(
            `https://platform.ringcentral.com/restapi/v1.0/account/~/extension/~/call-log?dateFrom=${startDate}&dateTo=${endDate}&page=${pageStart}&view=Simple&perPage=1000`,
            {
                headers: {
                    'Authorization': `Bearer ${rcAccessToken}`
                }
            }
        )
        result.records.push(...callLogResponse.data.records);
        if (callLogResponse.data.navigation?.nextPage) {
            pageStart++;
        }
        else {
            isFinalPage = true;
        }
    }
    return result;
}

async function getRcSMSLog({ rcAccessToken, dateRange, customStartDate, customEndDate }) {
    let startDate = '';
    let endDate = new Date(Date.now()).toISOString();
    switch (dateRange) {
        case 'Last 24 hours':
            startDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
            break;
        case 'Last 7 days':
            startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
            break;
        case 'Last 30 days':
            startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
            break;
        case 'Select date range...':
            startDate = customStartDate;
            endDate = customEndDate;
            break;
    }
    let pageStart = 1;
    let isFinalPage = false;
    let smsLogResponse = null;
    let result = { records: [] };
    while (!isFinalPage) {
        smsLogResponse = await axios.get(
            `https://platform.ringcentral.com/restapi/v1.0/account/~/extension/~/message-store?dateFrom=${startDate}&dateTo=${endDate}&page=${pageStart}&perPage=100`,
            {
                headers: {
                    'Authorization': `Bearer ${rcAccessToken}`
                }
            }
        );
        result.records.push(...smsLogResponse.data.records);
        if (smsLogResponse.data.navigation?.nextPage) {
            pageStart++;
        }
        else {
            isFinalPage = true;
        }
    }
    return result;
}

exports.getUserInfo = getUserInfo;
exports.getInteropCode = getInteropCode;
exports.getRcCallLog = getRcCallLog;
exports.getRcSMSLog = getRcSMSLog;