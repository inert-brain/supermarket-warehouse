const { queryRef, executeQuery, validateArgsWithOptions, mutationRef, executeMutation, validateArgs } = require('firebase/data-connect');

const StockStatus = {
  EMPTY: "EMPTY",
  OCCUPIED: "OCCUPIED",
  PENDING_DISPATCH: "PENDING_DISPATCH",
}
exports.StockStatus = StockStatus;

const connectorConfig = {
  connector: 'example',
  service: 'smart-warehouse-service',
  location: 'asia-southeast1'
};
exports.connectorConfig = connectorConfig;

const placeProductRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'PlaceProduct', inputVars);
}
placeProductRef.operationName = 'PlaceProduct';
exports.placeProductRef = placeProductRef;

exports.placeProduct = function placeProduct(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(placeProductRef(dcInstance, inputVars));
}
;

const takeOffRackRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'TakeOffRack', inputVars);
}
takeOffRackRef.operationName = 'TakeOffRack';
exports.takeOffRackRef = takeOffRackRef;

exports.takeOffRack = function takeOffRack(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(takeOffRackRef(dcInstance, inputVars));
}
;

const returnProductRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'ReturnProduct', inputVars);
}
returnProductRef.operationName = 'ReturnProduct';
exports.returnProductRef = returnProductRef;

exports.returnProduct = function returnProduct(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(returnProductRef(dcInstance, inputVars));
}
;

const moveProductRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'MoveProduct', inputVars);
}
moveProductRef.operationName = 'MoveProduct';
exports.moveProductRef = moveProductRef;

exports.moveProduct = function moveProduct(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(moveProductRef(dcInstance, inputVars));
}
;

const dispatchProductRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DispatchProduct', inputVars);
}
dispatchProductRef.operationName = 'DispatchProduct';
exports.dispatchProductRef = dispatchProductRef;

exports.dispatchProduct = function dispatchProduct(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(dispatchProductRef(dcInstance, inputVars));
}
;

const recordExpiredScanRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'RecordExpiredScan', inputVars);
}
recordExpiredScanRef.operationName = 'RecordExpiredScan';
exports.recordExpiredScanRef = recordExpiredScanRef;

exports.recordExpiredScan = function recordExpiredScan(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(recordExpiredScanRef(dcInstance, inputVars));
}
;

const getSlotBindingsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetSlotBindings');
}
getSlotBindingsRef.operationName = 'GetSlotBindings';
exports.getSlotBindingsRef = getSlotBindingsRef;

exports.getSlotBindings = function getSlotBindings(dcOrOptions, options) {

  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrOptions, options, undefined,false, false);
  return executeQuery(getSlotBindingsRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const getProductContextRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetProductContext', inputVars);
}
getProductContextRef.operationName = 'GetProductContext';
exports.getProductContextRef = getProductContextRef;

exports.getProductContext = function getProductContext(dcOrVars, varsOrOptions, options) {

  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getProductContextRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const getSlotMenuRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetSlotMenu');
}
getSlotMenuRef.operationName = 'GetSlotMenu';
exports.getSlotMenuRef = getSlotMenuRef;

exports.getSlotMenu = function getSlotMenu(dcOrOptions, options) {

  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrOptions, options, undefined,false, false);
  return executeQuery(getSlotMenuRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const getLocationSnapshotRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetLocationSnapshot', inputVars);
}
getLocationSnapshotRef.operationName = 'GetLocationSnapshot';
exports.getLocationSnapshotRef = getLocationSnapshotRef;

exports.getLocationSnapshot = function getLocationSnapshot(dcOrVars, varsOrOptions, options) {

  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getLocationSnapshotRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

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
