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

const reportSlotOccupancyRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'ReportSlotOccupancy', inputVars);
}
reportSlotOccupancyRef.operationName = 'ReportSlotOccupancy';
exports.reportSlotOccupancyRef = reportSlotOccupancyRef;

exports.reportSlotOccupancy = function reportSlotOccupancy(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(reportSlotOccupancyRef(dcInstance, inputVars));
}
;

const assignProductToSlotRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'AssignProductToSlot', inputVars);
}
assignProductToSlotRef.operationName = 'AssignProductToSlot';
exports.assignProductToSlotRef = assignProductToSlotRef;

exports.assignProductToSlot = function assignProductToSlot(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(assignProductToSlotRef(dcInstance, inputVars));
}
;

const changeAssignedSlotRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'ChangeAssignedSlot', inputVars);
}
changeAssignedSlotRef.operationName = 'ChangeAssignedSlot';
exports.changeAssignedSlotRef = changeAssignedSlotRef;

exports.changeAssignedSlot = function changeAssignedSlot(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(changeAssignedSlotRef(dcInstance, inputVars));
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

const dashboardStocksRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'DashboardStocks', inputVars);
}
dashboardStocksRef.operationName = 'DashboardStocks';
exports.dashboardStocksRef = dashboardStocksRef;

exports.dashboardStocks = function dashboardStocks(dcOrVars, varsOrOptions, options) {

  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(dashboardStocksRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const dashboardSlotsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'DashboardSlots', inputVars);
}
dashboardSlotsRef.operationName = 'DashboardSlots';
exports.dashboardSlotsRef = dashboardSlotsRef;

exports.dashboardSlots = function dashboardSlots(dcOrVars, varsOrOptions, options) {

  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(dashboardSlotsRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const dashboardActivitiesRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'DashboardActivities', inputVars);
}
dashboardActivitiesRef.operationName = 'DashboardActivities';
exports.dashboardActivitiesRef = dashboardActivitiesRef;

exports.dashboardActivities = function dashboardActivities(dcOrVars, varsOrOptions, options) {

  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(dashboardActivitiesRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
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
