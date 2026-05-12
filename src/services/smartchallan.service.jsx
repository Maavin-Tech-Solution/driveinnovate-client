import api from './api';

export const getScSettings    = ()       => api.get('/smartchallan/settings');
export const saveScSettings   = (data)   => api.put('/smartchallan/settings', data);
export const testScCredentials = (data)  => api.post('/smartchallan/settings/test', data);
export const getScRtoData     = ()       => api.get('/smartchallan/rto');
export const getScChallanData = ()       => api.get('/smartchallan/challan');
