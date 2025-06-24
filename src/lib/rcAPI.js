import axios from 'axios';

async function getUserInfo({ serverUrl, extensionId, accountId }) {
    const userInfoHashResponse = await axios.get(
        `${serverUrl}/userInfoHash?extensionId=${extensionId}&accountId=${accountId}`
    );
    return userInfoHashResponse.data;
}

async function getRcCallLog({ rcAccessToken, dateRange }) {
    let startDate = '';
    switch (dateRange) {
        case 'Day':
            startDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
            break;
        case 'Week':
            startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
            break;
        case 'Month':
            startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
            break;
    }
    const callLogResponse = await axios.get(
        `https://platform.ringcentral.com/restapi/v1.0/account/~/extension/~/call-log?dateFrom=${startDate}&view=Simple`,
        {
            headers: {
                'Authorization': `Bearer ${rcAccessToken}`
            }
        }
    );
    return callLogResponse.data;
}

async function getRcSMSLog({ rcAccessToken, dateRange }) {
    let startDate = '';
    switch (dateRange) {
        case 'Day':
            startDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
            break;
        case 'Week':
            startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
            break;
        case 'Month':
            startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
            break;
    }
    const smsLogResponse = await axios.get(
        `https://platform.ringcentral.com/restapi/v1.0/account/~/extension/~/message-store?dateFrom=${startDate}`,
        {
            headers: {
                'Authorization': `Bearer ${rcAccessToken}`
            }
        }
    );
    return smsLogResponse.data;
}

exports.getUserInfo = getUserInfo;
exports.getRcCallLog = getRcCallLog;
exports.getRcSMSLog = getRcSMSLog;