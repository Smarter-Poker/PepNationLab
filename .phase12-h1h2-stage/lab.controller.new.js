'use strict';

// ============================================================================
// Lab controller - lab orders + results endpoints (Phase 10).
// ----------------------------------------------------------------------------
//   GET   /api/patient/labs                    - patient lists their orders
//   GET   /api/patient/labs/:orderId           - patient reads one order
//   GET   /api/admin/labs                      - admin work queue
//   POST  /api/admin/labs                      - admin creates an order
//   PATCH /api/admin/labs/:orderId             - admin updates an order
//   POST  /api/admin/labs/:orderId/results     - admin adds a result row
//
// PHI separation: patient-facing handlers project via presentOrderForPatient
// which strips provider_notes. The admin handler returns the full row.
// ============================================================================

const labModel = require('../models/lab.model');
const labService = require('../services/lab');
const dependentModel = require('../models/dependent.model');
const notificationService = require('../services/notification');
const audit = require('../services/audit.service');
const errors = require('../utils/errors');
const logger = require('../utils/logger');

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const LAB_STATUSES = [
  'requested', 'collected', 'processing', 'resulted',
  'cancelled', 'abnormal_flagged',
];

function requestMeta(req) {
  return { ipAddress: req.ip, userAgent: req.get('user-agent') || null };
}

// Patient projection - excludes provider_notes regardless of source.
function presentOrderForPatient(row) {
  if (!row) return null;
  return {
    id: row.id,
    subscriptionId: row.subscription_id,
    providerId: row.provider_id,
    dependentId: row.dependent_id,
    status: row.status,
    protocolCategory: row.protocol_category,
    panelName: row.panel_name,
    panelReason: row.panel_reason,
    vendor: row.vendor,
    vendorOrderId: row.vendor_order_id,
    vendorRequisitionUrl: row.vendor_requisition_url,
    requestedAt: row.requested_at,
    collectedAt: row.collected_at,
    resultedAt: row.resulted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Admin projection - includes provider_notes.
function presentOrderForAdmin(row) {
  if (!row) return null;
  return Object.assign(presentOrderForPatient(row), {
    providerNotes: row.provider_notes,
  });
}

function presentResult(row) {
  if (!row) return null;
  return {
    id: row.id,
    labOrderId: row.lab_order_id,
    analyteName: row.analyte_name,
    valueText: row.value_text,
    unit: row.unit,
    referenceRange: row.reference_range,
    isAbnormal: row.is_abnormal,
    observedAt: row.observed_at,
    createdAt: row.created_at,
  };
}

// GET /api/patient/labs
async function listMyOrders(req, res, next) {
  try {
    const rows = await labModel.findOrdersByUser(req.user.id);
    const meta = requestMeta(req);
    await audit.record({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'lab.list.viewed',
      entityType: 'user',
      entityId: req.user.id,
      phiAccessed: true,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { count: rows.length },
    });
    res.status(200).json({ orders: rows.map(presentOrderForPatient) });
  } catch (err) {
    next(err);
  }
}

// GET /api/patient/labs/:orderId
async function getMyOrder(req, res, next) {
  try {
    const orderId =
      typeof req.params.orderId === 'string'
        ? req.params.orderId.trim()
        : '';
    if (!UUID_RE.test(orderId)) {
      return next(errors.badRequest('That Lab Order Reference Is Not Valid.'));
    }
    const row = await labModel.findOrderByIdForPatient(orderId);
    if (!row) {
      return next(errors.notFound('Lab Order Not Found.'));
    }
    if (row.user_id !== req.user.id) {
      return next(errors.forbidden('You May Only View Your Own Lab Orders.'));
    }
    const results = await labModel.findResultsByOrder(orderId);
    const meta = requestMeta(req);
    await audit.record({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'lab.viewed',
      entityType: 'lab_order',
      entityId: row.id,
      phiAccessed: true,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    res.status(200).json({
      order: presentOrderForPatient(row),
      results: results.map(presentResult),
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/admin/labs
async function listAllOrders(req, res, next) {
  try {
    const status =
      typeof req.query.status === 'string' ? req.query.status.trim() : '';
    if (status && LAB_STATUSES.indexOf(status) === -1) {
      return next(errors.badRequest('That Status Filter Is Not Valid.'));
    }
    const rows = await labModel.findAllOrders(status ? { status: status } : {});
    const meta = requestMeta(req);
    await audit.record({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'lab.admin.list.viewed',
      entityType: 'lab_order',
      entityId: null,
      phiAccessed: true,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { status: status || 'all', count: rows.length },
    });
    res.status(200).json({ orders: rows.map(presentOrderForAdmin) });
  } catch (err) {
    next(err);
  }
}

// POST /api/admin/labs
async function adminCreateOrder(req, res, next) {
  try {
    const body = req.body || {};
    const userId =
      typeof body.userId === 'string' ? body.userId.trim() : '';
    if (!UUID_RE.test(userId)) {
      return next(errors.badRequest('A Valid Patient Reference Is Required.'));
    }
    const panelName =
      typeof body.panelName === 'string' ? body.panelName.trim() : '';
    if (panelName.length === 0) {
      return next(errors.badRequest('A Panel Name Is Required.'));
    }
    if (panelName.length > 200) {
      return next(errors.badRequest('Panel Name Is Too Long.'));
    }
    const panelReason =
      typeof body.panelReason === 'string' && body.panelReason.trim()
        ? body.panelReason.trim()
        : null;
    let providerId = null;
    if (typeof body.providerId === 'string' && body.providerId.trim()) {
      const trimmedProvider = body.providerId.trim();
      if (!UUID_RE.test(trimmedProvider)) {
        return next(errors.badRequest('That Provider Reference Is Not Valid.'));
      }
      providerId = trimmedProvider;
    }
    let subscriptionId = null;
    if (typeof body.subscriptionId === 'string' && body.subscriptionId.trim()) {
      const trimmedSub = body.subscriptionId.trim();
      if (!UUID_RE.test(trimmedSub)) {
        return next(errors.badRequest('That Subscription Reference Is Not Valid.'));
      }
      subscriptionId = trimmedSub;
    }
    // Phase 12: optional dependent linkage on lab orders. Admin scope, so
    // we trust the admin's selection (no parent ownership check). We
    // still UUID-validate so a malformed value yields a clean 400.
    let dependentId = null;
    if (typeof body.dependentId === 'string' && body.dependentId.trim()) {
      const trimmedDep = body.dependentId.trim();
      if (!UUID_RE.test(trimmedDep)) {
        return next(errors.badRequest('That Dependent Reference Is Not Valid.'));
      }
      const dep = await dependentModel.findById(trimmedDep);
      if (!dep) {
        return next(errors.badRequest('That Dependent Reference Is Not Valid.'));
      }
      if (!dep.is_active) {
        return next(errors.badRequest('That Dependent Has Been Removed. Restore Them Before Submitting New Care.'));
      }
      dependentId = trimmedDep;
    }
    const protocolCategory =
      typeof body.protocolCategory === 'string' && body.protocolCategory.trim()
        ? body.protocolCategory.trim()
        : null;

    const created = await labModel.createOrder({
      userId: userId,
      subscriptionId: subscriptionId,
      providerId: providerId,
      dependentId: dependentId,
      panelName: panelName,
      panelReason: panelReason,
      protocolCategory: protocolCategory,
    });

    // Wire the vendor requisition. The stub adapter is deterministic so
    // a re-call would produce the same row; failures throw and the row
    // remains intact (vendor columns null) so an admin can retry.
    try {
      const vendor = await labService.createOrderWithVendor(created.id);
      const updated = await labModel.updateOrder(created.id, {
        vendor: vendor.vendor,
        vendorOrderId: vendor.vendorOrderId,
        vendorRequisitionUrl: vendor.vendorRequisitionUrl,
      });
      if (updated) {
        Object.assign(created, updated);
      }
    } catch (err) {
      logger.warn('lab.adminCreateOrder: vendor wiring failed', {
        labOrderId: created.id,
        message: err && err.message,
      });
    }

    const meta = requestMeta(req);
    await audit.record({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'lab.admin.created',
      entityType: 'lab_order',
      entityId: created.id,
      phiAccessed: true,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { panel: panelName, userId: userId },
    });
    res.status(201).json({ order: presentOrderForAdmin(created) });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/admin/labs/:orderId
async function adminUpdateOrder(req, res, next) {
  try {
    const orderId =
      typeof req.params.orderId === 'string'
        ? req.params.orderId.trim()
        : '';
    if (!UUID_RE.test(orderId)) {
      return next(errors.badRequest('That Lab Order Reference Is Not Valid.'));
    }
    const body = req.body || {};
    const data = {};
    if (typeof body.status === 'string') {
      if (LAB_STATUSES.indexOf(body.status) === -1) {
        return next(errors.badRequest('That Status Is Not Valid.'));
      }
      data.status = body.status;
    }
    if (typeof body.providerId === 'string') {
      const trimmedProvider = body.providerId.trim();
      if (trimmedProvider === '') {
        data.providerId = null;
      } else if (!UUID_RE.test(trimmedProvider)) {
        return next(errors.badRequest('That Provider Reference Is Not Valid.'));
      } else {
        data.providerId = trimmedProvider;
      }
    }
    if (typeof body.collectedAt === 'string') {
      const trimmed = body.collectedAt.trim();
      if (trimmed === '') {
        data.collectedAt = null;
      } else {
        const parsed = new Date(trimmed);
        if (Number.isNaN(parsed.getTime())) {
          return next(errors.badRequest('That Collection Time Is Not Valid.'));
        }
        data.collectedAt = parsed.toISOString();
      }
    }
    if (typeof body.resultedAt === 'string') {
      const trimmed = body.resultedAt.trim();
      if (trimmed === '') {
        data.resultedAt = null;
      } else {
        const parsed = new Date(trimmed);
        if (Number.isNaN(parsed.getTime())) {
          return next(errors.badRequest('That Result Time Is Not Valid.'));
        }
        data.resultedAt = parsed.toISOString();
      }
    }
    if (typeof body.providerNotes === 'string') {
      const trimmed = body.providerNotes.trim();
      data.providerNotes = trimmed === '' ? null : trimmed;
    }

    const current = await labModel.findOrderById(orderId);
    if (!current) {
      return next(errors.notFound('Lab Order Not Found.'));
    }

    // Auto-stamp resulted_at when status flips to a terminal "results
    // ready" state ('resulted' or 'abnormal_flagged') and it was not
    // set by the caller. Both states are treated equivalently for
    // patient-notification purposes - the patient needs to know their
    // results landed regardless of whether anything was flagged.
    if (
      (data.status === 'resulted' || data.status === 'abnormal_flagged') &&
      !Object.prototype.hasOwnProperty.call(data, 'resultedAt') &&
      !current.resulted_at
    ) {
      data.resultedAt = new Date().toISOString();
    }

    const updated = await labModel.updateOrder(orderId, data);
    if (!updated) {
      return next(errors.notFound('Lab Order Not Found.'));
    }

    // Notify the patient when the order lands at a terminal results-
    // ready state ('resulted' or 'abnormal_flagged') AND at least one
    // result row exists. Dedupe key includes resulted_at so a re-result
    // fires a fresh email. Both terminal states are treated as ready-
    // to-review from the patient's perspective.
    if (
      (updated.status === 'resulted' ||
        updated.status === 'abnormal_flagged') &&
      updated.resulted_at
    ) {
      const results = await labModel.findResultsByOrder(orderId);
      if (results.length > 0) {
        const resultedIso = new Date(updated.resulted_at).toISOString();
        await notificationService.send({
          userId: updated.user_id,
          template: 'lab_result_ready',
          payload: { panelName: updated.panel_name },
          dedupeKey:
            'lab_result_ready:' + updated.id + ':' + resultedIso,
        });
      }
    }

    const meta = requestMeta(req);
    await audit.record({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'lab.admin.updated',
      entityType: 'lab_order',
      entityId: updated.id,
      // PHI true: handler may have written/read provider_notes.
      phiAccessed: true,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { status: updated.status },
    });
    res.status(200).json({ order: presentOrderForAdmin(updated) });
  } catch (err) {
    next(err);
  }
}

// POST /api/admin/labs/:orderId/results
async function adminAddResult(req, res, next) {
  try {
    const orderId =
      typeof req.params.orderId === 'string'
        ? req.params.orderId.trim()
        : '';
    if (!UUID_RE.test(orderId)) {
      return next(errors.badRequest('That Lab Order Reference Is Not Valid.'));
    }
    const body = req.body || {};
    const analyteName =
      typeof body.analyteName === 'string' ? body.analyteName.trim() : '';
    if (analyteName.length === 0) {
      return next(errors.badRequest('An Analyte Name Is Required.'));
    }
    const valueText =
      typeof body.valueText === 'string' ? body.valueText.trim() : '';
    if (valueText.length === 0) {
      return next(errors.badRequest('A Result Value Is Required.'));
    }
    const unit =
      typeof body.unit === 'string' && body.unit.trim()
        ? body.unit.trim()
        : null;
    const referenceRange =
      typeof body.referenceRange === 'string' && body.referenceRange.trim()
        ? body.referenceRange.trim()
        : null;
    const isAbnormal = body.isAbnormal === true || body.isAbnormal === 'true';
    let observedAt = null;
    if (typeof body.observedAt === 'string' && body.observedAt.trim()) {
      const parsed = new Date(body.observedAt.trim());
      if (Number.isNaN(parsed.getTime())) {
        return next(errors.badRequest('That Observation Time Is Not Valid.'));
      }
      observedAt = parsed.toISOString();
    }

    const order = await labModel.findOrderById(orderId);
    if (!order) {
      return next(errors.notFound('Lab Order Not Found.'));
    }

    const created = await labModel.addResult({
      labOrderId: orderId,
      analyteName: analyteName,
      valueText: valueText,
      unit: unit,
      referenceRange: referenceRange,
      isAbnormal: isAbnormal,
      observedAt: observedAt,
    });

    // D9: bump the parent order's updated_at so list views reflect the
    // latest activity even though only a child row was inserted.
    try {
      await labModel.touchOrder(orderId);
    } catch (err) {
      logger.warn('lab.adminAddResult: touchOrder failed', {
        labOrderId: orderId,
        message: err && err.message,
      });
    }

    // D1: when the parent order is already at a terminal results-ready
    // state ('resulted' or 'abnormal_flagged') with a resulted_at stamp
    // but no notification fired (because the order had zero results
    // at the moment status flipped), fire the email now that the first
    // result is in. Dedupe key (resultedIso) ensures at most one email
    // per (orderId, resulted_at) tuple regardless of how many subsequent
    // results are added or which handler triggers the send.
    if (
      (order.status === 'resulted' ||
        order.status === 'abnormal_flagged') &&
      order.resulted_at
    ) {
      const resultedIso = new Date(order.resulted_at).toISOString();
      await notificationService.send({
        userId: order.user_id,
        template: 'lab_result_ready',
        payload: { panelName: order.panel_name },
        dedupeKey:
          'lab_result_ready:' + orderId + ':' + resultedIso,
      });
    }

    const meta = requestMeta(req);
    await audit.record({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'lab.admin.result.added',
      entityType: 'lab_order',
      entityId: orderId,
      phiAccessed: true,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { analyte: analyteName, isAbnormal: isAbnormal },
    });
    res.status(201).json({ result: presentResult(created) });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listMyOrders: listMyOrders,
  getMyOrder: getMyOrder,
  listAllOrders: listAllOrders,
  adminCreateOrder: adminCreateOrder,
  adminUpdateOrder: adminUpdateOrder,
  adminAddResult: adminAddResult,
  LAB_STATUSES: LAB_STATUSES,
};
