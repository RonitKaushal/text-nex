const { DisconnectReason } = require("baileys");



exports.SUPPORTED_FILE_TYPES = ["image", "video", "audio", "document"];

exports.SUPPORTED_MIME_TYPES = {
  image: ["image/png", "image/jpg", "image/jpeg", "image/gif"],
  video: ["video/mp4", "video/avi", "video/mpeg", "video/quicktime"],
  audio: ["audio/mpeg", "audio/wav", "audio/ogg"],
  document: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ],
};

exports.MESSAGE_COLUMNS = [
  'name', 'phone', 'var1', 'var2', 'var3', 'var4', 'var5', 'var6', 'var7', 'var8', 'var9', 'var10', 'var11', 'var12', 'var13', 'var14', 'var15', 'var16', 'var17', 'var18', 'var19', 'var20', 'var21', 'var22', 'var23', 'var24', 'var25', 'var26', 'var27', 'var28', 'var29', 'var30',
];

exports.WHATSAPP_STATUS = {
  CONNECTED: "connected",
  DISCONNECTED: "disconnected",
};

exports.RECIPIENT_STATUS = {
  PENDING: "pending",
  SENT: "sent",
  FAILED: "failed",
  NOT_EXIST: "not_exist",
  INSTANCE_DISCONNECTED: "instance_disconnected"
}

exports.MESSAGE_STATUS = {
  COMPLETED: "completed",
  FAILED: "failed",
  PENDING: "pending",
  PROCESSING: "processing",
  PAUSED: "paused",
  STOP: "stop",
}

exports.DISCONNECTED_REASON = {
  [DisconnectReason.connectionClosed]: "Connection closed",
  [DisconnectReason.connectionLost]: "Connection lost",
  [DisconnectReason.connectionReplaced]: "Connection replaced",
  [DisconnectReason.timedOut]: "Timed out",
  [DisconnectReason.loggedOut]: "Logged out",
  [DisconnectReason.badSession]: "Bad session",
  [DisconnectReason.restartRequired]: "Restart required",
  [DisconnectReason.multideviceMismatch]: "Multidevice mismatch",
  [DisconnectReason.forbidden]: "Forbidden",
  [DisconnectReason.unavailableService]: "Unavailable service",
};

exports.BUTTON_TYPES = {
  URL: "URL",
  REPLY: "REPLY",
  Call: "Call",
  Copy: "Copy",
};

exports.TEMPLATE_TYPES = {
  // WHATSAPP_CRM_USER: "wa-crm-user",
  INCOMING_CALL: "incoming_call",
  OUTGOING_CALL: "outgoing_call",
  MISSED_CALL: "missed_call",
  NOT_ANSWERED_CALL: "not_answered_call",
  CUSTOM: "custom",
};

exports.HEADER_TYPES = {
  TEXT: "text",
  MEDIA: "media",
};

exports.INSTANCE_STATUS = {
  CONNECTED: "connected",
  DISCONNECTED: "disconnected",
  CONNECTING: "connecting",
};


exports.Message_Type = {
  TEXT: "Text",
  BUTTONS: "Buttons",
  MEDIA: "Media",
  POLL: "Poll",
  LIST: "List",
  CAROUSEL: "Carousel"
}

exports.INTEGRATION_NAME = {
  INDIAMART: "indiamart",
  CHATGPT: "chatgpt",
  GEMINI: "gemini"
}
exports.INTEGRATION_STATUS = {
  CONNECTED: "connected",
  DISCONNECTED: "disconnected",
}

exports.MESSAGE_TYPES = {
  TEXT: "text",
  BUTTON: "button",
  MENU: "menu",
  POLL: "poll",
  MEDIA: "media",
}