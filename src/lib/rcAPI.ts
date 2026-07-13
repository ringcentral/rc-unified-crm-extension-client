import axios from 'axios';

type UnknownRecord = Record<string, any>;

class RcAPI {
    constructor() { }

    rcExtensions: UnknownRecord[] = [];

    async getUserInfo({ serverUrl, extensionId, accountId }: UnknownRecord): Promise<UnknownRecord> {
        const userInfoHashResponse = await axios.get(
            `${serverUrl}/userInfoHash?extensionId=${extensionId}&accountId=${accountId}`
        );
        return userInfoHashResponse.data;
    }

    async getInteropCode({ rcAccessToken, rcClientId }: UnknownRecord): Promise<unknown> {
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

    async getRcCallLog({ rcAccessToken, dateRange, customStartDate, customEndDate }: UnknownRecord): Promise<UnknownRecord> {
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
        let callLogResponse: UnknownRecord | null = null;
        let result: UnknownRecord = { records: [] };
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

    async getRcSMSLog({ rcAccessToken, dateRange, customStartDate, customEndDate }: UnknownRecord): Promise<UnknownRecord> {
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
        let smsLogResponse: UnknownRecord | null = null;
        let result: UnknownRecord = { records: [] };
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

    async getRcExtensionList({ rcAccessToken }: UnknownRecord): Promise<UnknownRecord[]> {
        if (this.rcExtensions.length > 0) {
            return this.rcExtensions;
        }
        let isFinalPage = false;
        let pageStart = 1;
        let extensionListResponse: UnknownRecord | null = null;
        let extensionCollection: UnknownRecord = { records: [] };
        while (!isFinalPage) {
            extensionListResponse = await axios.get(`https://platform.ringcentral.com/restapi/v1.0/account/~/extension?page=${pageStart}&perPage=100`,
                {
                    headers: {
                        'Authorization': `Bearer ${rcAccessToken}`
                    }
                });
            extensionCollection.records.push(...extensionListResponse.data.records);
            if (extensionListResponse.data.navigation?.nextPageUrl) {
                pageStart++;
            }
            else {
                isFinalPage = true;
            }
        }
        const result = extensionCollection.records.filter(extension => extension.type == 'User').map(extension => ({
            id: extension.id,
            name: extension.name || `${extension.contact?.firstName} ${extension.contact?.lastName}`,
            extensionNumber: extension.extensionNumber || '',
            email: extension.contact?.email
        }));
        this.rcExtensions = result;
        return result;
    }

}

export { RcAPI };
