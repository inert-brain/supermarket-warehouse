const { queryRef, executeQuery, validateArgsWithOptions, validateArgs } = require('firebase/data-connect');

const connectorConfig = {
  connector: 'example',
  service: 'smart-warehouse-service',
  location: 'asia-southeast1'
};
exports.connectorConfig = connectorConfig;

const getStockByProductIdRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetStockByProductID', inputVars);
}
getStockByProductIdRef.operationName = 'GetStockByProductID';
exports.getStockByProductIdRef = getStockByProductIdRef;

exports.getStockByProductId = function getStockByProductId(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getStockByProductIdRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;
