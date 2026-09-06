"use strict";

const TERMS_VERSION = "2026-09-06";
const STATES = new Set(
  "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(
    " ",
  ),
);
class MarketplaceError extends Error {
  constructor(code, message, status = 422) {
    super(message);
    this.code = code;
    this.status = status;
  }
}
function assertVisible(product) {
  if (
    product.moderation_status === "hidden" ||
    Number(product.seller_suspended)
  ) {
    throw new MarketplaceError(
      "PRODUCT_MODERATED",
      "Este anúncio foi retirado do catálogo pela moderação.",
      409,
    );
  }
}
function orderTransition(order, actorId, action, now = Date.now()) {
  const seller = String(order.seller_customer_id) === String(actorId);
  const buyer = String(order.buyer_customer_id) === String(actorId);
  if (!seller && !buyer)
    throw new MarketplaceError(
      "ORDER_NOT_FOUND",
      "Negociação não encontrada.",
      404,
    );
  // Replaying an already applied action never executes another transition.
  const replay = {
    accept: "accepted",
    reject: "rejected",
    cancel: "cancelled",
    complete: "completed",
  }[action];
  if (
    order.status === replay &&
    ((["accept", "reject"].includes(action) && seller) ||
      (action === "cancel" && buyer) ||
      action === "complete")
  ) {
    return { status: order.status, productStatus: null, replay: true };
  }
  if (
    order.status === "requested" &&
    new Date(order.expires_at).getTime() <= now &&
    action === "accept"
  ) {
    throw new MarketplaceError(
      "RESERVATION_EXPIRED",
      "A reserva expirou. Atualize as negociações.",
      409,
    );
  }
  if (
    action === "accept" &&
    seller &&
    order.status === "requested" &&
    order.product_status === "reserved"
  ) {
    assertVisible(order);
    return { status: "accepted", productStatus: "sold" };
  }
  if (action === "reject" && seller && order.status === "requested")
    return { status: "rejected", productStatus: "active" };
  if (action === "cancel" && buyer && order.status === "requested")
    return { status: "cancelled", productStatus: "active" };
  if (action === "complete" && order.status === "accepted")
    return { status: "completed", productStatus: null };
  throw new MarketplaceError(
    "ORDER_ACTION_NOT_ALLOWED",
    "Esta ação não está disponível para a negociação.",
    409,
  );
}
module.exports = {
  MarketplaceError,
  TERMS_VERSION,
  STATES,
  assertVisible,
  orderTransition,
};
