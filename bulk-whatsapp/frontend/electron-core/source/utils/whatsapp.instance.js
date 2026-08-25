if (!globalThis.crypto) {
  globalThis.crypto = require('crypto').webcrypto || require('crypto');
}

const path = require('node:path');
const {
  default: makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  generateWAMessageFromContent,
  generateWAMessageContent,
  proto,
  makeCacheableSignalKeyStore,
  prepareWAMessageMedia,
  generateMessageID,
  delay,
  downloadMediaMessage
} = require("baileys");

const { applyVariable } = require("./send.until");
const fs = require("fs");
const fsPromises = require('fs').promises;
const pino = require('pino');
const { v4: uuidv4 } = require('uuid');
const socket = require("./socket.io");
const mime = require("mime-types");
const QRCode = require("qrcode");
const { WHATSAPP_STATUS, Message_Type, BUTTON_TYPES } = require("./enums");
const { sleep, getMimeType } = require("./common.util");
const axios = require('axios');
const sharp = require('sharp');
const { resolveMediaSource } = require('./resolveMedia.util');
const PDFDocument = require('pdfkit');
const crypto = require('crypto');
const ffmpeg = require('fluent-ffmpeg');

// Add fetch import for Node.js versions that don't have it globally
const fetch = globalThis.fetch || require('node-fetch');

const logger = pino({ level: 'silent' });

function getSessionsRoot() {
  return process.env.LOCAL_SESSION_PATH || path.join(__dirname, '..', 'sessions');
}

const instanceRegistry = require("./instanceRegistry");

// Global storage for bot functionality
if (!global.selectedImages) global.selectedImages = {};
if (!global.movieSearchResults) global.movieSearchResults = {};

const BotTemplate = require("../models/botTemplate.model");

const tempImageQueue = [];
const MAX_TEMP_IMAGES = 3;

const additionalNodes = [
  {
    tag: "biz",
    attrs: {},
    content: [
      {
        tag: "interactive",
        attrs: {
          v: "1",
          type: "native_flow",
        },
        content: [
          {
            tag: "native_flow",
            attrs: {
              v: "2",
              name: "mixed",
            },
            content: [],
          },
        ],
      },
    ],
  },
];

function objectToString(obj, indent = 0, refMap = new Map()) {
    if (obj === null || obj === undefined) return 'null';
    if (typeof obj !== 'object') return JSON.stringify(obj);

    if (refMap.has(obj)) {
        return `[Circular *${refMap.get(obj)}]`;
    }

    const refNumber = refMap.size + 1;
    refMap.set(obj, refNumber);

    const indentStr = '  '.repeat(indent);
    const entries = Object.entries(obj);
    if (entries.length === 0) return '{}';

    let result = '{\n';
    const childIndent = indent + 1;
    const childIndentStr = '  '.repeat(childIndent);

    entries.forEach(([key, value], index) => {
        let formattedValue;

        if (Array.isArray(value)) {
            if (value.length === 0) {
                formattedValue = '[]';
            } else {
                const arrayItems = value.map(item => `${childIndentStr}  ${objectToString(item, childIndent + 1, refMap)}`).join(',\n');
                formattedValue = `[\n${arrayItems}\n${childIndentStr}]`;
            }
        } else if (typeof value === 'object' && value !== null) {
            formattedValue = objectToString(value, childIndent, refMap);
        } else {
            formattedValue = JSON.stringify(value);
        }

        result += `${childIndentStr}${key}: ${formattedValue}`;
        if (index < entries.length - 1) result += ',';
        result += '\n';
    });

    result += `${indentStr}}`;
    return result;
}

function generateMessageId() {
  return crypto.randomBytes(11).toString('hex').toUpperCase();
}

class WhatsAppInstance {
  constructor(id) {
    this.id = id.toString();
    this.authState = null;
    this.sock = null;
    
    // Connection state
    this.qr = null;
    this.qrRetry = 0;
    this.maxQrRetry = 6;
    this.qrTimeout = false;
    this.connected = false;
    this.isConnected = false;
    this.restart = false;
    this.io = socket.getInstance();
    this.status = "";
    this.message = "";
    this.number = "";
    this.reconnectAttempts = 0;
    this._loading = false;
  }

  // Session management
  sessionPath() {
    return path.join(getSessionsRoot(), this.id);
  }

  deleteSession() {
    return new Promise((resolve) => {
      const sessionPath = this.sessionPath();
      if (fs.existsSync(sessionPath)) {
        fs.rmSync(sessionPath, { recursive: true, force: true });
        console.log(`Session directory removed for instance: ${this.id}`);
      }
      resolve(true);
    });
  }

  async create() {
    const sessionPath = this.sessionPath();
    console.log("Creating session directory:", sessionPath);
    
    if (!fs.existsSync(sessionPath)) {
      fs.mkdirSync(sessionPath, { recursive: true });
    }
    
    this.authState = await useMultiFileAuthState(sessionPath);
  }

  async init() {
    try {
      const { version, isLatest } = await fetchLatestBaileysVersion();
      console.log(`Instance ${this.id}: Using WA v${version.join(".")}, isLatest: ${isLatest}`);

      instanceRegistry.updateInstance(this.id, {
        whatsapp: { status: WHATSAPP_STATUS.CONNECTING },
      });

      this.sock = makeWASocket({
        version: version,
        printQRInTerminal: false,
        auth: {
          creds: this.authState.state.creds,
          keys: makeCacheableSignalKeyStore(this.authState.state.keys, logger),
        },
        logger: logger,
        browser: ['Mac OS', 'chrome', '121.0.6167.159'],
        connectTimeoutMs: 60_000,
        keepAliveIntervalMs: 30_000,
        emitOwnEvents: false,
        markOnlineOnConnect: false,
        syncFullHistory: false,
        shouldSyncHistoryMessage: () => false,
        downloadHistory: false,
        getMessage: async () => ({ conversation: "Hello" }),
        generateHighQualityLinkPreview: false
      });

      this.initListeners();
      return this;
    } catch (error) {
      console.error(`Instance ${this.id}: Init error:`, error.message);
      throw error;
    }
  }

  initListeners() {
    this.qrRetry = 0;
    this.sock.ev.on("creds.update", this.authState.saveCreds);
    this.sock.ev.on("connection.update", this.handleConnectionUpdate.bind(this));
    this.sock.ev.on("messages.upsert", this.handleMessages.bind(this));
  }

  async handleMessages({ messages }) {
    const m = messages[0];
    if (!m || !m.message) {
      console.log('Message ignored: No valid message object');
      return;
    }

    // Extract details for saving
    try {
        const isFromMe = m.key.fromMe;
        if (!isFromMe) { // Only save incoming messages
            const from = m.key.remoteJid.replace("@s.whatsapp.net", "");
            const to = this.number || (this.sock?.user?.id ? this.sock.user.id.split(":")[0] : "");
            const pushName = m.pushName || "";
            let messageType = "";
            let messageContent = "";

            if (m.message.conversation) {
                messageType = 'conversation';
                messageContent = m.message.conversation;
            } else if (m.message.extendedTextMessage) {
                messageType = 'extendedTextMessage';
                messageContent = m.message.extendedTextMessage.text;
            } else if (m.message.buttonsResponseMessage) {
                messageType = 'buttonsResponseMessage';
                messageContent = m.message.buttonsResponseMessage.selectedDisplayText || 'Button clicked';
            } else if (m.message.templateButtonReplyMessage) {
                messageType = 'templateButtonReplyMessage';
                messageContent = m.message.templateButtonReplyMessage.selectedDisplayText || 'Button clicked';
            } else if (m.message.interactiveResponseMessage) {
                messageType = 'interactiveResponseMessage';
                // best-effort text extraction
                messageContent = 'Interactive response';
            } else {
                // Filter: Ignore any other message types (images, videos, protocol messages, etc.)
                return;
            }

            // Fetch profile picture
            let profilePicUrl = "";
            try {
                profilePicUrl = await this.sock.profilePictureUrl(m.key.remoteJid, "image");
            } catch (err) {
                console.log("Error fetching profile picture:", err.message);
            }

            // Create received message record
            const newMessage = {
                instance_id: this.id,
                from,
                to,
                pushName,
                messageType: messageType.replace('Message', ''),
                message: messageContent,
                profilePicUrl,
                timestamp: new Date((m.messageTimestamp || Date.now() / 1000) * 1000)
            };

            // Emit socket event
            try {
                const instanceDoc = instanceRegistry.getInstance(this.id);
                if (instanceDoc && instanceDoc.userId) {
                    // Add userId to message object
                    newMessage.userId = instanceDoc.userId;

                    const io = socket.getIO();
                    if (io) {
                        io.to(instanceDoc.userId.toString()).emit('new_message', newMessage);
                        io.to(instanceDoc.userId.toString()).emit('received_message', newMessage);
                        // Also emit instance specific event just in case
                        io.to(instanceDoc.userId.toString()).emit(`received_message_${this.id}`, newMessage);
                    }
                } else if (this.io) {
                    // Fallback to broadcast if user lookup fails (though ideally shouldn't happen)
                     this.io.emit(`new_message`, newMessage);
                     this.io.emit(`received_message`, newMessage);
                }
            } catch (err) {
                console.error("Error emitting socket event:", err);
            }
        }
    } catch (err) {
        console.error("Error saving received message:", err);
    }

    const text =
      m.message.conversation ||
      m.message.extendedTextMessage?.text ||
      m.message.buttonsResponseMessage?.selectedDisplayText ||
      m.message.templateButtonReplyMessage?.selectedDisplayText ||
      '';
    const lowerText = text.toLowerCase().trim();
    const chatJid = m.key.remoteJid;
    const isFromBotOwner = m.key.fromMe;
    const senderNumber = chatJid.split('@')[0];
    console.log('Received message:', text);
    console.log('Chat JID:', chatJid);
    console.log('Is from bot owner:', isFromBotOwner);

    const getInnerMessage = (message) => {
      let m = message?.message || {};
      if (m.ephemeralMessage) m = m.ephemeralMessage.message || {};
      if (m.viewOnceMessage) m = m.viewOnceMessage.message || {};
      if (m.documentWithCaptionMessage) m = m.documentWithCaptionMessage.message || {};
      return m;
    };
    const getButtonResponse = (msg) => {
      try {
        const inner = getInnerMessage(msg);
        const br = inner?.buttonsResponseMessage;
        if (br?.selectedButtonId) {
          return { id: br.selectedButtonId, text: br.selectedDisplayText || '' };
        }
        const tr = inner?.templateButtonReplyMessage;
        if (tr?.selectedId) {
          return { id: tr.selectedId, text: tr.selectedDisplayText || '' };
        }
        const ir = inner?.interactiveResponseMessage;
        const nf = ir?.nativeFlowResponseMessage;
        if (nf?.paramsJson) {
          try {
            const params = JSON.parse(nf.paramsJson);
            return { id: params.id || params.button_id || params.cta_id || '', text: params.display_text || params.selection?.title || '' };
          } catch (_) {}
        }
        const lr = inner?.listResponseMessage;
        const sel = lr?.singleSelectReply;
        if (sel?.selectedRowId) {
          return {
            id: sel.selectedRowId,
            text: lr?.title || lr?.description || sel.selectedRowId || ''
          };
        }
      } catch (_) {}
      return null;
    };
    const buttonResponse = getButtonResponse(m);
    if (buttonResponse) {
      console.log("[buttonResponse]", {
        chatJid,
        id: buttonResponse.id,
        text: buttonResponse.text,
      });
    }

    const restrictedCommands = [
      'm.script',
      /.image_\d+/,
      '/.image_done',
      '/.>'
    ];

    const isRestrictedCommand = restrictedCommands.some(cmd => 
      typeof cmd === 'string' ? text.toLowerCase().startsWith(cmd.toLowerCase()) : cmd.test(text)
    );

    const allowOwnerTrigger = process.env.ALLOW_SELF_TEST === 'true' && isFromBotOwner && (lowerText.startsWith('#test') || !!buttonResponse);

    if (isRestrictedCommand && !isFromBotOwner && !allowOwnerTrigger) {
      console.log('Non-owner tried to use a restricted command');
      await this.sock.sendMessage(chatJid, { text: 'This command is restricted to the bot owner only.' });
      return;
    }

    const isGroup = chatJid.endsWith('@g.us');
    const triggerKeyword = (process.env.TRIGGER_KEYWORD || 'testing').toLowerCase().trim();
    // IMPORTANT:
    // Disable bot flow in group chats. Only allow 1-to-1 chats to trigger bot replies.
    // (Owner self-test can still be enabled via ALLOW_SELF_TEST for debugging.)
    if (isGroup && !allowOwnerTrigger) {
      return;
    }

    // Handle m.script command
    if (text.toLowerCase() === 'm.script') {
      console.log('Processing m.script...');
      const contextInfo = m.message.extendedTextMessage?.contextInfo;
      const quotedMessage = contextInfo?.quotedMessage || contextInfo?.quotedMsg;

      if (quotedMessage) {
        const quotedData = {
          key: {
            remoteJid: m.key.remoteJid,
            fromMe: m.key.fromMe,
            id: m.key.id,
          },
          message: quotedMessage,
          id: contextInfo.stanzaId || m.key.id,
          chat: m.key.remoteJid,
          sender: contextInfo.participant || m.key.participant,
          fromMe: contextInfo.participant === this.sock.user.id,
          text: quotedMessage.conversation || quotedMessage.extendedTextMessage?.text || '',
          mentionedJid: contextInfo.mentionedJid || [],
          fakeObj: {
            messageStubParameters: [],
            labels: [],
            userReceipt: [],
            reactions: [],
            pollUpdates: [],
            eventResponses: [],
            messageAddOns: [],
            statusMentions: [],
            supportAiCitations: [],
          },
        };

        const generatedCode = `<ref *1> InteractiveMessage ${objectToString({
          ...quotedMessage,
          id: quotedData.id,
          chat: quotedData.chat,
          sender: quotedData.sender,
          fromMe: quotedData.fromMe,
          text: quotedData.text,
          mentionedJid: quotedData.mentionedJid,
          fakeObj: `WebMessageInfo ${objectToString(quotedData.fakeObj)}`,
          key: `MessageKey ${objectToString(quotedData.key)}`,
          message: `Message { interactiveMessage: [Circular *1] }`,
        })}`;

        try {
          await this.sock.sendMessage(chatJid, { text: generatedCode });
        } catch (error) {
          console.error('Error sending message:', error);
          await this.sock.sendMessage(chatJid, { text: 'Error generating script code' });
        }
      } else {
        await this.sock.sendMessage(chatJid, { text: 'Please quote a message to use m.script' });
      }
      return;
    }

    // Handle image to PDF commands
    if (text.match(/^\/\.image_\d+$/) || text === '/.image_done') {
      const selectedImages = global.selectedImages;
      
      if (!selectedImages[chatJid]) {
        selectedImages[chatJid] = {};
      }

      if (text.match(/^\/\.image_\d+$/)) {
        const imageNumber = text.split('_')[1];
        const contextInfo = m.message.extendedTextMessage?.contextInfo;
        const quotedMessage = contextInfo?.quotedMessage;

        if (!quotedMessage || !quotedMessage.imageMessage) {
          await this.sock.sendMessage(chatJid, { text: `Please quote an image message for /.image_${imageNumber}` });
          return;
        }

        try {
          let buffer;
          try {
            buffer = await downloadMediaMessage(
              { message: quotedMessage },
              'buffer',
              {},
              { reuploadRequest: this.sock.updateMediaMessage }
            );
          } catch (fetchError) {
            const imageUrl = quotedMessage.imageMessage.url;
            const response = await axios.get(imageUrl, {
              responseType: 'arraybuffer',
              headers: { 'User-Agent': 'WhatsApp/2.23.10.76' },
            });
            buffer = Buffer.from(response.data);
          }

          if (!buffer || !buffer.length) {
            throw new Error('Empty image buffer received');
          }

          let processedBuffer;
          try {
            processedBuffer = await sharp(buffer)
              .jpeg()
              .toBuffer();
          } catch (sharpError) {
            throw new Error(`Sharp processing failed: ${sharpError.message}`);
          }

          selectedImages[chatJid][imageNumber] = processedBuffer;
          await this.sock.sendMessage(chatJid, { text: `Image Added ${imageNumber} Successfully` });

        } catch (error) {
          console.error('Error selecting image:', error);
          await this.sock.sendMessage(chatJid, {
            text: `Error converting image ${imageNumber} to PDF: ${error.message}`,
          });
        }
      } else if (text === '/.image_done') {
        try {
          const imageBuffers = selectedImages[chatJid];

          if (!imageBuffers || Object.keys(imageBuffers).length === 0) {
            await this.sock.sendMessage(chatJid, { text: 'No images selected. Use /.image_1, /.image_2, etc. first.' });
            return;
          }

          const pdfDoc = new PDFDocument();
          const pdfPath = `./converted_pdf_${chatJid.split('@')[0]}.pdf`;
          const pdfStream = fs.createWriteStream(pdfPath);

          pdfDoc.pipe(pdfStream);

          const imageNumbers = Object.keys(imageBuffers).sort((a, b) => parseInt(a) - parseInt(b));
          for (const num of imageNumbers) {
            if (num !== imageNumbers[0]) pdfDoc.addPage();
            pdfDoc.image(imageBuffers[num], {
              fit: [500, 500],
              align: 'center',
              valign: 'center',
            });
          }

          pdfDoc.end();

          await new Promise((resolve, reject) => {
            pdfStream.on('finish', resolve);
            pdfStream.on('error', reject);
          });

          const pdfBuffer = fs.readFileSync(pdfPath);

          await this.sock.sendMessage(chatJid, {
            document: pdfBuffer,
            mimetype: 'application/pdf',
            fileName: `converted_pdf.pdf`,
          });

          await this.sock.sendMessage(chatJid, { text: `All selected images combined into a single PDF and sent!` });

          fs.unlinkSync(pdfPath);
          delete selectedImages[chatJid];

        } catch (error) {
          console.error('Error combining images into PDF:', error);
          await this.sock.sendMessage(chatJid, {
            text: `Error combining images into PDF: ${error.message}`,
          });
        }
      }
      return;
    }

    if (text.toLowerCase().startsWith('/.>')) {
      try {
        const command = text.slice(3);
        const [wordPart, countPart] = command.split('*');
        const word = wordPart.trim();
        const count = countPart ? parseInt(countPart.trim(), 10) : 1;

        if (!word || isNaN(count) || count < 1 || count > 100) {
          await this.sock.sendMessage(chatJid, { text: 'Invalid command. Use /.>word*number (e.g., /.>hello*5, max 100)' });
          return;
        }

        for (let i = 0; i < count; i++) {
          await this.sock.sendMessage(chatJid, { text: word });
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        console.log(`Repeater completed: Sent "${word}" ${count} times`);
      } catch (error) {
        console.error('Error processing repeater command:', error);
        await this.sock.sendMessage(chatJid, { text: 'Error processing your command.' });
      }
      return;
    }

    // Chat-flow / bot-flow feature removed — inbound messages are stored via other handlers only.
  }

  async requestPairingCode(phoneNumber) {
    if (!this.sock) {
      await this.init();
    }

    // Wait for a moment to ensure socket is ready
    await sleep(1000);

    if (!this.sock.authState.creds.registered) {
      try {
        // Validate and format phone number
        // Remove + and non-numeric chars
        const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');

        console.log(`Requesting pairing code for ${cleanNumber}`);
        const code = await this.sock.requestPairingCode(cleanNumber);
        return code;
      } catch (error) {
        console.error('Pairing code error:', error);
        throw error;
      }
    } else {
      throw new Error("Instance already registered/connected");
    }
  }

  async handleConnectionUpdate(update) {
    const { connection, lastDisconnect, qr } = update;
    const instance = instanceRegistry.getInstance(this.id);
    const userId = instance?.userId?.toString();

    if (qr) {
      await this.handleQRCode(qr, userId);
    } else if (connection === 'close') {
      await this.handleDisconnection(lastDisconnect, userId, instance);
    } else if (connection === 'open') {
      await this.handleConnection(userId, instance);
    }
  }

  async handleQRCode(qr, userId) {
    this.qrRetry++;
    
    if (this.qrRetry > this.maxQrRetry) {
      console.log(`Instance ${this.id}: QR code attempts limit reached`);
      
      if (!(this.connected || this.restart)) {
        this.qrRetry = 0;
        this.qrTimeout = true;
        await this.sock?.ev?.removeAllListeners();
        await this.sock?.logout?.();
      }
      return;
    }

    try {
      const qrCode = await QRCode.toDataURL(qr);
      this.qr = qrCode;
      this.qrTimeout = false;

      this.emitToUser(userId, "instance.qr", {
        instanceId: this.id,
        qr: this.qr || ""
      });

      instanceRegistry.updateInstance(this.id, {
        whatsapp: {
          status: WHATSAPP_STATUS.CONNECTING,
          qr: this.qr,
        },
      });
    } catch (error) {
      console.error(`Instance ${this.id}: Error generating QR:`, error);
    }
  }

  async scheduleReconnect(userId, instance, reason) {
    this.reconnectAttempts = (this.reconnectAttempts || 0) + 1;
    const maxAttempts = 8;
    if (this.reconnectAttempts > maxAttempts) {
      console.warn(
        `Instance ${this.id}: giving up reconnect after ${maxAttempts} attempts (${reason})`
      );
      this.connected = false;
      this.isConnected = false;
      this.sock = null;
      instanceRegistry.updateInstance(this.id, {
        whatsapp: {
          status: WHATSAPP_STATUS.DISCONNECTED,
          qr: '',
          disconnectReason: reason,
        },
      });
      this.emitToUser(userId, 'instance.update', {
        instanceId: this.id,
        name: instance?.name || 'whatsapp-instance',
        whatsapp: {
          ...(instance?.whatsapp || {}),
          status: WHATSAPP_STATUS.DISCONNECTED,
          qr: '',
          disconnectReason: reason,
        },
      });
      return false;
    }

    const waitMs = Math.min(30000, 1500 * this.reconnectAttempts);
    console.log(
      `Instance ${this.id}: reconnect ${this.reconnectAttempts}/${maxAttempts} in ${waitMs}ms (${reason})`
    );
    instanceRegistry.updateInstance(this.id, {
      whatsapp: {
        status: WHATSAPP_STATUS.CONNECTING,
        qr: '',
      },
    });
    await delay(waitMs);
    await this.init();
    return true;
  }

  async handleDisconnection(lastDisconnect, userId, instance) {
    const statusCode = lastDisconnect?.error?.output?.statusCode;
    const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

    this.connected = false;
    this.isConnected = false;
    this.restart = statusCode === DisconnectReason.restartRequired;

    console.log(`Instance ${this.id}: Disconnected with code ${statusCode}`);

    if (statusCode === DisconnectReason.badSession) {
      this.status = "badSession";
      this.message = "Bad session file, delete and run again";
      await this.scheduleReconnect(userId, instance, 'badSession');
    } else if (statusCode === DisconnectReason.connectionClosed) {
      this.status = "connectionClosed";
      this.message = "Connection closed, reconnecting....";
      console.log(this.id, "Connection closed, reconnecting....");
      await this.scheduleReconnect(userId, instance, 'connectionClosed');
    } else if (statusCode === DisconnectReason.connectionLost) {
      this.status = "connectionLost";
      this.message = "Connection lost, reconnecting....";
      console.log(this.id, "Connection lost, reconnecting....");
      await this.scheduleReconnect(userId, instance, 'connectionLost');
    } else if (statusCode === DisconnectReason.connectionReplaced) {
      this.status = "connectionReplaced";
      this.message = "Connection Replaced, Another New Session Opened";
      console.log(this.id, "Connection Replaced");
      // Don't auto-reconnect on connectionReplaced.
      // This usually means the same WhatsApp account is connected elsewhere; looping reconnects
      // will cause "Connection Closed" send failures and unstable behavior.
      instanceRegistry.updateInstance(this.id, {
        whatsapp: {
          status: WHATSAPP_STATUS.DISCONNECTED,
          disconnectReason: DisconnectReason.connectionReplaced,
          qr: "",
        },
      });
      this.emitToUser(userId, "instance.update", {
        instanceId: this.id,
        name: instance?.name || "whatsapp-instance",
        whatsapp: {
          ...(instance?.whatsapp || {}),
          status: WHATSAPP_STATUS.DISCONNECTED,
          qr: "",
          disconnectReason: DisconnectReason.connectionReplaced
        }
      });
      return;
    } else if (statusCode === DisconnectReason.loggedOut) {
      this.isConnected = false;
      
      if (this.qrTimeout) {
        this.status = "QR Timeout";
        this.message = "Click on Show QR to connect WhatsApp";
      } else {
        this.status = "loggedOut";
        this.message = "Device Logged Out, Deleting Session.";
        
        instanceRegistry.updateInstance(this.id, {
          whatsapp: {
            status: WHATSAPP_STATUS.DISCONNECTED,
            phone: "",
            profile: "",
            name: "",
            qr: "",
            disconnectReason: DisconnectReason.loggedOut,
          },
        });

        this.emitToUser(userId, "instance.update", {
          instanceId: this.id,
          name: instance?.name || "whatsapp-instance",
          whatsapp: {
            status: WHATSAPP_STATUS.DISCONNECTED,
            phone: "",
            profile: "",
            name: "",
            qr: "",
            disconnectReason: DisconnectReason.loggedOut
          }
        });

        if (shouldReconnect) {
          await delay(2000);
          await this.init();
        } else {
          await delay(1000);
          await this.deleteSession();
        }
      }
    } else if (statusCode === DisconnectReason.restartRequired) {
      this.status = "Connecting...";
      this.message = "Restart required, restarting...";
      this.restart = true;
      await this.scheduleReconnect(userId, instance, 'restartRequired');
    } else if (statusCode === DisconnectReason.timedOut) {
      this.status = "timedOut";
      this.message = "Connection timedOut, reconnecting...";
      await this.scheduleReconnect(userId, instance, 'timedOut');
    } else if (shouldReconnect) {
      await this.scheduleReconnect(userId, instance, String(statusCode || 'unknown'));
    }

    instanceRegistry.updateInstance(this.id, {
      status: this.status,
      message: this.message,
      number: "",
      whatsapp: {
        ...(instanceRegistry.getInstance(this.id)?.whatsapp || {}),
        qr: "",
      },
    });
  }

  async handleConnection(userId, instance) {
    console.log(`Instance ${this.id}: Connection opened successfully`);
    this.qr = null;
    this.qrRetry = 0;
    this.qrTimeout = false;
    this.connected = true;
    this.isConnected = true;
    this.restart = false;
    this.reconnectAttempts = 0;

    await delay(2000);

    if (this.sock.authState.creds && !this.sock.authState.creds.myAppStateKeyId) {
      this.sock.ev.flush();
    }

    const jid = `${this.sock.user.id.split(":")[0]}@s.whatsapp.net`;
    const [profileImageUrl, statusInfo] = await Promise.all([
      this.sock.profilePictureUrl(jid, 'image').catch(() => null),
      this.sock.fetchStatus(jid).catch(() => []),
    ]);

    this.number = this.sock.user.id.split(":")[0];

    const whatsappData = {
      status: WHATSAPP_STATUS.CONNECTED,
      name: this.sock.user?.name || this.sock.user?.verifiedName || "",
      profile: profileImageUrl,
      bio: statusInfo?.[0]?.status?.status || "",
      phone: this.number,
      disconnectReason: 0,
      qr: "",
    };

    instanceRegistry.updateInstance(this.id, { whatsapp: whatsappData });

    this.emitToUser(userId, "instance.update", {
      instanceId: this.id,
      ...(instance || {}),
      whatsapp: whatsappData,
    });
  }

  async emitToUser(userId, eventName, data) {
    if (this.io) {
      this.io.to(userId).emit(eventName, data);
    }
  }

  async stopListeners() {
    try {
      this.sock?.ev.removeAllListeners();
      delete this.sock?.ev.on;
      this.sock?.ws.close();
    } catch (error) {
      console.log(`Instance ${this.id}: stopListeners error:`, error.message);
    }
  }

  async logout() {
    try {
      if (!this.sock) return { status: false, message: "No active session" };
      
      this.connected = false;
      this.isConnected = false;
      
      await this.sock.logout();
      return { status: true, message: "Logged out successfully" };
    } catch (error) {
      console.error(`Instance ${this.id}: Error logging out:`, error);
      return { status: false, message: "Failed to logout", error: error.message };
    }
  }

  async destroy() {
    try {
      this.qr = null;
      this.qrRetry = 0;
      this.qrTimeout = false;
      this.connected = false;
      this.isConnected = false;
      this.restart = false;
      this._loading = false;
      await this.stopListeners();
      this.sock = null;
    } catch (error) {
      console.error(`Instance ${this.id}: Error destroying session:`, error);
    }
  }

  // WhatsApp ID utilities
  getWhatsAppId(id) {
    if (id.includes("@g.us") || id.includes("@s.whatsapp.net") || id.includes("@lid")) return id;
    return id.includes("-") ? `${id}@g.us` : `${id}@s.whatsapp.net`;
  }

  // validate WhatsApp ID
  async validateWhatsAppId(phone) {
    try {
      if (phone.includes("@g.us")) {
        return { exists: true, jid: phone };
      }
      // Linked device JIDs can come as *@lid. Treat as valid JID.
      if (phone.includes("@lid") || phone.includes("@s.whatsapp.net")) {
        return { exists: true, jid: phone };
      }

      const cleanPhone = phone.replace(/[^0-9]/g, "");
      
      if (cleanPhone.length < 10 || cleanPhone.length > 15) {
        return { exists: false, jid: this.getWhatsAppId(cleanPhone) };
      }
      
      const jid = this.getWhatsAppId(cleanPhone);
      const [result] = await this.sock.onWhatsApp(jid);

      if (!result && jid.startsWith("55")) {
        const number = jid.split("@")[0];
        let newNumber = number;

        if (newNumber.length === 12) {
          newNumber = newNumber.split("");
          newNumber.splice(4, 0, "9");
          newNumber = newNumber.join("");
        }

        const [result2] = await this.sock.onWhatsApp(`${newNumber}@s.whatsapp.net`);
        return result2 ?? { exists: false, jid: jid };
      }

      return result ?? { exists: false, jid: jid };
    } catch (error) {
      console.log(`Instance ${this.id}: verifyId Error: ${error.message}`);
      return { exists: false, jid: phone };
    }
  }

  async presenceUpdate(jid, status) {
    await this.sock.presenceSubscribe(jid);
    await delay(250);
    await this.sock.sendPresenceUpdate(status, jid);
    await delay(750);
    await this.sock.sendPresenceUpdate('paused', jid);
  }
/// text
  async sendTextMessage(phone, message) {
    try {
      const { exists, jid } = await this.validateWhatsAppId(phone);

      if (!exists) {
        return {
          status: false,
          message: "Invalid phone number or not registered on WhatsApp",
          jid: jid
        };
      }
      const sendOnce = async () => {
        await this.presenceUpdate(jid, 'composing');
        return await this.sock.sendMessage(jid, { text: message });
      };

      let result;
      try {
        result = await sendOnce();
      } catch (error) {
        const msg = error?.output?.payload?.message || error?.message || '';
        // Retry once on transient connection closure
        if (msg.toLowerCase().includes('connection closed')) {
          console.warn(`Instance ${this.id}: sendTextMessage retry after connection closed`);
          try {
            await this.init();
          } catch (_) {}
          result = await sendOnce();
        } else {
          throw error;
        }
      }

      if (result) {
        return { status: true, message: "Message sent", result: result };
      } else {
        return { status: false, message: "Error sending message" };
      }
    } catch (error) {
      console.error(`Instance ${this.id}: Error in sendTextMessage for ${phone}:`, error);
      return { status: false, message: `Error: ${error.message}`, error: error.message };
    }
  }
/// action button

  async sendActionButtonMessage(phone, message, title, footer, button_actions) {
    try {
      const { exists, jid } = await this.validateWhatsAppId(phone);
      if (!exists) {
        return {
          status: false,
          message: "Invalid phone number or not registered on WhatsApp",
          jid
        };
      }

      const withPresence = async (fn) => {
        await this.presenceUpdate(jid, 'composing');
        return await fn();
      };

      const isAllReplyButtons = button_actions.every(button => button.type === "REPLY");

      const attemptSend = async () => {
        if (isAllReplyButtons) {
        const msgSecret = Buffer.from(uuidv4()).toString('base64');
        const buttons = button_actions.map((button) => ({
          buttonId: button.id || `reply_${Math.random().toString(36).substr(2, 9)}`,
          buttonText: { displayText: button.label },
          type: 1
        }));

        const buttonsMessage = {
          contentText: message || "",
          footerText: footer || "",
          contextInfo: { disappearingMode: { initiator: "CHANGED_IN_CHAT" } },
          buttons,
          title: title || "",
          headerType: 1
        };

        const docMessage = {
          documentWithCaptionMessage: {
            message: { buttonsMessage }
          }
        };

        const result = await this.sock.relayMessage(
          jid,
          docMessage,
          {
            messageId: generateMessageID(),
            messageSecret: msgSecret,
            additionalNodes
          }
        );

        return result ? 
          { status: true, message: "Legacy button message sent successfully", result } :
          { status: false, message: "Error sending legacy button message" };
        }
        // interactive buttons branch (existing code below)
        return null;
      };

      // Presence + retry wrapper for both branches
      let legacyResult = null;
      try {
        legacyResult = await withPresence(attemptSend);
      } catch (error) {
        const msg = error?.output?.payload?.message || error?.message || '';
        if (msg.toLowerCase().includes('connection closed')) {
          console.warn(`Instance ${this.id}: sendActionButtonMessage retry after connection closed`);
          try {
            await this.init();
          } catch (_) {}
          legacyResult = await withPresence(attemptSend);
        } else {
          throw error;
        }
      }
      if (legacyResult) return legacyResult;

      // Non-legacy interactive buttons path
      // (keep your existing logic, but ensure presence already sent above if needed)
      // NOTE: we already did presence in withPresence(attemptSend) only for legacy,
      // so we do it again here for interactive branch.
      await this.presenceUpdate(jid, 'composing');

      if (!isAllReplyButtons) {
        const buttons = button_actions.map((button) => {
          if (button.type === "Copy") {
            return {
              name: "cta_copy",
              buttonParamsJson: JSON.stringify({
                display_text: button.label,
                id: button.id,
                copy_code: button.copy_code,
              }),
            };
          } else if (button.type === "Call") {
            return {
              name: "cta_call",
              buttonParamsJson: JSON.stringify({
                display_text: button.label,
                id: button.id,
                phone_number: `+${button.phone}`,
              }),
            };
          } else if (button.type === "URL") {
            return {
              name: "cta_url",
              buttonParamsJson: JSON.stringify({
                display_text: button.label,
                url: button.url,
                merchant_url: button.merchant_url || button.url,
              }),
            };
          } else if (button.type === "REPLY") {
            return {
              name: "quick_reply",
              buttonParamsJson: JSON.stringify({
                display_text: button.label,
                id: button.id,
              }),
            };
          } else {
            throw new Error(`Unsupported button type: ${button.type}`);
          }
        });

        const btnMessage = {
          interactiveMessage: proto.Message.InteractiveMessage.create({
            header: proto.Message.InteractiveMessage.Header.create({
              title: title || "",
              hasMediaAttachment: false
            }),
            body: proto.Message.InteractiveMessage.Body.create({
              text: message || ""
            }),
            footer: proto.Message.InteractiveMessage.Footer.create({
              text: footer || ""
            }),
            nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
              buttons
            })
          })
        };

        const result = await this.sock.relayMessage(
          jid,
          btnMessage,
          {
            messageId: generateMessageID(),
            additionalNodes
          }
        );

        return result ?
          { status: true, message: "Interactive button message sent successfully", result } :
          { status: false, message: "Error sending interactive button message" };
      }
    } catch (error) {
      console.error(`Instance ${this.id}: Error in sendActionButtonMessage [${phone}]:`, error);
      return { status: false, message: "Error sending button message", error: error.message };
    }
  }

// send template
  async sendTemplate(contact, template) {
    try {
      const { phone, name, variables = {} } = contact;
      const { messageType, template: templateData } = template;

      const { exists } = await this.validateWhatsAppId(phone);

      if (!exists) {
        return {
          status: false,
          isValid: false,
          message: 'Phone number is not available at whatsapp',
        };
      }

      // Apply variables to template content
      const variableData = { phone, name, ...variables };
      const message = await applyVariable(templateData.message || '', variableData);
      const header = await applyVariable(templateData.header || '', variableData);
      const footer = await applyVariable(templateData.footer || '', variableData);

      let result;

      if (messageType === Message_Type.TEXT) {
        result = await this.sendTextMessage(phone, message);
      } else if (messageType === Message_Type.BUTTONS) {
        const buttonActions = templateData.button?.map(btn => ({
          type: btn.type,
          label: btn.title,
          ...(btn.type === BUTTON_TYPES.URL && { url: btn.url }),
          ...(btn.type === BUTTON_TYPES.Call && { phone: btn.phone }),
          ...(btn.type === BUTTON_TYPES.Copy && { copyCode: btn.copyCode }),
          ...(btn.type === BUTTON_TYPES.REPLY && { id: btn.id || `btn_${Date.now()}` })
        })) || [];

        result = await this.sendActionButtonMessage(
          phone, message, header, footer, buttonActions
        );
      } else if (messageType === Message_Type.MEDIA) {
        // Handle media templates with or without buttons
        const buttonActions = templateData.button?.map(btn => ({
          type: btn.type,
          label: btn.title,
          ...(btn.type === BUTTON_TYPES.URL && { url: btn.url }),
          ...(btn.type === BUTTON_TYPES.Call && { phone: btn.phone }),
          ...(btn.type === BUTTON_TYPES.Copy && { copyCode: btn.copyCode }),
          ...(btn.type === BUTTON_TYPES.REPLY && { id: btn.id || `btn_${Date.now()}` })
        })) || [];

        // Create media object from template data
        const media = {
          url: templateData.media
        };

        // If there are no buttons, send media without buttons
        if (buttonActions.length === 0) {
          result = await this.sendMediaMessage(phone, message, media);
        } else {
          result = await this.sendMediaWithButtonsMessage(
            phone, message, media, buttonActions, header, footer
          );
        }
      } else if (messageType === Message_Type.POLL) {
        // Handle poll templates
        const pollOptions = templateData.poll?.options || [];
        const pollMaxOptions = templateData.poll?.maxOptions || 0;
        
        result = await this.sendPollMessage(
          phone, message, pollOptions, pollMaxOptions
        );
      } else if (messageType === Message_Type.LIST) {
        // Handle list/templates with options
        const optionList = {
          button_label: templateData.list?.buttonText || "Choose",
          footer: footer || "",
          section_title: templateData.list?.sectionTitle || "Options",
          options: templateData.list?.options || []
        };
        
        result = await this.sendOptionsList(
          phone, message, header, optionList
        );
      } else if (messageType === Message_Type.CAROUSEL) {
        // Handle carousel templates
        const carouselCards = templateData.carousel?.cards || [];
        
        // Transform carousel cards to the format expected by sendCarousel
        const carousel = carouselCards.map(card => ({
          media: card.media,
          text: card.text,
          footer: card.footer || "",
          buttons: card.buttons?.map(btn => ({
            type: btn.type,
            label: btn.title,
            ...(btn.type === BUTTON_TYPES.URL && { url: btn.url }),
            ...(btn.type === BUTTON_TYPES.Call && { phone: btn.phone }),
            ...(btn.type === BUTTON_TYPES.Copy && { copy_code: btn.copyCode }),
            ...(btn.type === BUTTON_TYPES.REPLY && { id: btn.id || `btn_${Date.now()}` })
          })) || []
        }));
        
        result = await this.sendCarousel(
          phone, message, footer, carousel
        );
      }

      return result;
    } catch (error) {
      console.error(`Instance ${this.id}: sendTemplate Error:`, error);
      return {
        status: false,
        message: 'Error sending template message',
        error: error.message
      };
    }
  }

  async deleteMessage(phone, messageId) {
    try {
      const { exists, jid } = await this.validateWhatsAppId(phone);
      if (!exists) return { status: false, message: "Invalid phone number", jid };
      if (!messageId) return { status: false, message: "Message ID is required" };

      const result = await this.sock.sendMessage(jid, {
        delete: {
          remoteJid: jid,
          id: messageId,
          fromMe: true
        }
      });

      return { status: true, message: "Message deleted", result };
    } catch (error) {
      console.error(`Instance ${this.id}: Delete Message Error:`, error);
      return { status: false, message: "Error deleting message", error: error.message };
    }
  }

  generateThumbnail(mediaBuffer, mimeType) {
    return new Promise(async (resolve) => { 
      const thumbnailPath = path.join(process.platform === "win32" ? "C:\\tmp" : "/tmp", "thumbnail.jpg");
      const tempVideoPath = path.join(process.platform === "win32" ? "C:\\tmp" : "/tmp", `${uuidv4()}.mp4`);

      try {
        if (mimeType.startsWith("image/")) {
          const thumbnailBuffer = await sharp(mediaBuffer)
            .resize({ width: 150 })
            .jpeg({ quality: 80 })
            .toBuffer();
          resolve(thumbnailBuffer);
        } else if (mimeType.startsWith("video/")) {
          const tmpDir = process.platform === "win32" ? "C:\\tmp" : "/tmp";
          if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);

          fs.writeFileSync(tempVideoPath, mediaBuffer);

          await new Promise((thumbResolve, thumbReject) => {
            ffmpeg(tempVideoPath)
              .screenshots({
                count: 1,
                folder: tmpDir,
                size: "150x?",
                filename: "thumbnail.jpg",
                timemarks: ['2'],
              })
              .on("end", () => thumbResolve())
              .on("error", thumbReject);
          });

          const thumbnailBuffer = fs.readFileSync(thumbnailPath);
          resolve(thumbnailBuffer);
        } else {
          resolve(null); 
        }
      } catch (error) {
        console.error("Error generating thumbnail:", error);
        resolve(null); 
      } finally {
        if (fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath);
        if (fs.existsSync(thumbnailPath)) fs.unlinkSync(thumbnailPath);
      }
    });
  }

  async loadMediaFromInput(media) {
    if (media?.tempFilePath && media?.name) {
      const mediaBuffer = fs.readFileSync(media.tempFilePath);
      const fileName = media.name;
      const mimeType = getMimeType(fileName);
      return { mediaBuffer, mimeType, fileName };
    }

    const source = media?.url || media?.path;
    if (!source) {
      throw new Error('Media file is required. Upload locally on your device.');
    }

    const { buffer, mimeType, fileName } = await resolveMediaSource(source);
    return { mediaBuffer: buffer, mimeType, fileName };
  }

  sendMediaMessage(phone, message, media) {
    return new Promise(async (resolve) => {
      try {
        const { exists, jid } = await this.validateWhatsAppId(phone);
        if (!exists) return resolve({ status: false, message: "Invalid phone number" });

        let mediaBuffer, mimeType, fileName;
        ({ mediaBuffer, mimeType, fileName } = await this.loadMediaFromInput(media));

        if (!mediaBuffer || !mimeType) {
          throw new Error(`Invalid media data or unable to determine MIME type. Media buffer: ${!!mediaBuffer}, MIME type: ${mimeType || 'undefined'}`);
        }

        const supportedTypes = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'application/pdf'];
        if (!supportedTypes.includes(mimeType)) {
          throw new Error("Unsupported media type. Use JPEG, PNG, WEBP, MP4, or PDF");
        }

        const thumbnailBuffer = await this.generateThumbnail(mediaBuffer, mimeType);

        const result = await this.sock.sendMessage(jid, {
          [mimeType.startsWith("image/") ? "image" :
           mimeType.startsWith("video/") ? "video" : "document"]: mediaBuffer,
          caption: message,
          mimetype: mimeType,
          ...(mimeType.startsWith("video/") && thumbnailBuffer && { jpegThumbnail: thumbnailBuffer }),
          ...(mimeType.startsWith("document/") && { fileName }),
        });

        resolve({ status: true, message: "Message sent", result });
      } catch (error) {
        console.error(`Error in sendMediaMessage [${phone}]:`, error);
        resolve({ status: false, message: "Error sending media", error: error.message });
      }
    });
  }

  async sendMediaWithButtonsMessage(phone, message, media, button_actions, title, footer) {
    return new Promise(async (resolve) => {
      try {
        const { exists, jid } = await this.validateWhatsAppId(phone);
        if (!exists) {
          return resolve({
            status: false,
            message: "Invalid phone number or not registered on WhatsApp",
            jid,
          });
        }

        // Only validate button_actions if they are provided
        if (button_actions !== undefined && button_actions !== null) {
          if (!Array.isArray(button_actions) || button_actions.length === 0) {
            throw new Error("button_actions must be a non-empty array");
          }
        } else {
          // If no button_actions provided, set to empty array
          button_actions = [];
        }

        let mediaBuffer, mimeType, fileName;
        ({ mediaBuffer, mimeType, fileName } = await this.loadMediaFromInput(media));

        if (!mediaBuffer || !mimeType) {
          throw new Error(`Invalid media data or unable to determine MIME type. Media buffer: ${!!mediaBuffer}, MIME type: ${mimeType || 'undefined'}`);
        }

        const supportedTypes = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'application/pdf'];
        if (!supportedTypes.includes(mimeType)) {
          throw new Error("Unsupported media type. Use JPEG, PNG, WEBP, MP4, or PDF");
        }

        const thumbnailBuffer = await this.generateThumbnail(mediaBuffer, mimeType);

        const hasReplyButton = button_actions.some(button => button.type === "REPLY");

        if (hasReplyButton) {
          const mediaMessage = await prepareWAMessageMedia(
            {
              [mimeType.startsWith("image/") ? "image" :
               mimeType.startsWith("video/") ? "video" : "document"]: mediaBuffer,
              ...(thumbnailBuffer && { jpegThumbnail: thumbnailBuffer }),
            },
            { upload: this.sock.waUploadToServer }
          );

          const mediaResult = await this.sock.relayMessage(
            jid,
            {
              [mimeType.startsWith("image/") ? "imageMessage" :
               mimeType.startsWith("video/") ? "videoMessage" : "documentMessage"]: mediaMessage[
                mimeType.startsWith("image/") ? "imageMessage" :
                mimeType.startsWith("video/") ? "videoMessage" : "documentMessage"
              ],
            },
            { messageId: generateMessageID() }
          );

          if (!mediaResult) {
            return resolve({
              status: false,
              message: "Error sending media",
            });
          }

          const buttonResult = await this.sendActionButtonMessage(
            phone,
            message, 
            title,
            footer, 
            button_actions
          );

          if (buttonResult.status) {
            resolve({
              status: true,
              message: "Media and buttons sent successfully",
              result: {
                media: mediaResult,
                buttons: buttonResult.result,
              },
            });
          } else {
            resolve({
              status: false,
              message: "Error sending buttons after media",
              error: buttonResult.error,
            });
          }
        } else {
          const buttons = button_actions.map((button) => {
            if (button.type === "Copy") {
              return {
                name: "cta_copy",
                buttonParamsJson: JSON.stringify({
                  display_text: button.label,
                  id: button.id,
                  copy_code: button.copy_code,
                }),
              };
            } else if (button.type === "Call") {
              return {
                name: "cta_call",
                buttonParamsJson: JSON.stringify({
                  display_text: button.label,
                  id: button.id,
                  phone_number: `+${button.phone}`,
                }),
              };
            } else if (button.type === "URL") {
              return {
                name: "cta_url",
                buttonParamsJson: JSON.stringify({
                  display_text: button.label,
                  url: button.url,
                  merchant_url: button.merchant_url || button.url,
                }),
              };
            } else if (button.type === "REPLY") {
              return {
                name: "quick_reply",
                buttonParamsJson: JSON.stringify({
                  display_text: button.label,
                  id: button.id,
                }),
              };
            } else {
              throw new Error(`Unsupported button type: ${button.type}`);
            }
          });

          const mediaMessage = await prepareWAMessageMedia(
            {
              [mimeType.startsWith("image/") ? "image" :
               mimeType.startsWith("video/") ? "video" : "document"]: mediaBuffer,
              ...(thumbnailBuffer && { jpegThumbnail: thumbnailBuffer }),
            },
            { upload: this.sock.waUploadToServer }
          );

          const interactiveMessage = proto.Message.InteractiveMessage.create({
            header: proto.Message.InteractiveMessage.Header.create({
              title: title || "",
              hasMediaAttachment: true,
              [mimeType.startsWith("image/") ? "imageMessage" :
               mimeType.startsWith("video/") ? "videoMessage" : "documentMessage"]: mediaMessage[
                mimeType.startsWith("image/") ? "imageMessage" :
                mimeType.startsWith("video/") ? "videoMessage" : "documentMessage"
              ],
            }),
            body: proto.Message.InteractiveMessage.Body.create({
              text: message || "",
            }),
            footer: proto.Message.InteractiveMessage.Footer.create({
              text: footer || "Powered by WhatsApp Bot",
            }),
            nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
              buttons,
            }),
          });

          const result = await this.sock.relayMessage(
            jid,
            { interactiveMessage },
            { messageId: generateMessageID(), additionalNodes }
          );

          if (result) {
            resolve({
              status: true,
              message: "Media with buttons sent successfully",
              result,
            });
          } else {
            resolve({
              status: false,
              message: "Error sending media with buttons",
            });
          }
        }
      } catch (error) {
        console.error(`Error in sendMediaWithButtonsMessage [${phone}]:`, error);
        resolve({
          status: false,
          message: "Error sending media with buttons",
          error: error.message || "Unknown error",
        });
      }
    });
  }

  sendPollMessage(phone, message, poll, poll_max_options = null) {
    return new Promise(async (resolve) => {
      const { exists, jid } = await this.validateWhatsAppId(phone);
      
        if (!exists) {
          resolve({
            status: false,
            message: "Invalid phone number or not registered on WhatsApp",
            jid: jid
          });
          return;
        }
  
      try {
        const options = poll.map(option => option.name);
        
        const result = await this.sock.sendMessage(jid, {
          poll: {
            name: message,
            values: options,
            selectableCount: poll_max_options || 0,
          },
        });
        
        if (result) {
          resolve({
            status: true,
            message: "Poll message sent successfully",
            result,
          });
        } else {
          resolve({
            status: false,
            message: "Error sending poll message",
          });
        }
      } catch (error) {
        console.error("Error in sendPollMessage:", error);
        resolve({
          status: false,
          message: "Error sending poll message",
          error: error.message,
        });
      }
    });
  }

  async sendOptionsList(phone, message, title, option_list) {
    return new Promise(async (resolve) => {
      try {
        const { exists, jid } = await this.validateWhatsAppId(phone);
  
        if (!exists) {
          resolve({
            status: false,
            message: "Invalid phone number or not registered on WhatsApp",
            jid
          });
          return;
        }
  
        if (!option_list?.options || !Array.isArray(option_list.options) || option_list.options.length === 0) {
          throw new Error("option_list must contain a non-empty options array");
        }
  
        const menuMessage = {
          messageContextInfo: {
            deviceListMetadataVersion: 2,
            deviceListMetadata: {}
          },
          listMessage: proto.Message.ListMessage.create({
            title: title || "Select an Option",
            description: message || "",
            buttonText: option_list.button_label || "Choose",
            footerText: option_list.footer || "",
            listType: 1,
            sections: [
              {
                title: option_list.section_title || "Options",
                rows: option_list.options.map((option, index) => {
                  if (!option.title) {
                    throw new Error(`Option at index ${index} is missing required title`);
                  }
                  return {
                    rowId: option.id || `option_${index + 1}_${Math.random().toString(36).substr(2, 9)}`,
                    title: option.title,
                    description: option.description || ""
                  };
                })
              }
            ]
          })
        };
  
        console.log(`Sending list message to ${jid}`);
        const result = await this.sock.relayMessage(
          jid,
          menuMessage,
          {
            messageId: generateMessageID(),
            additionalNodes: [
              {
                tag: "biz",
                attrs: {},
                content: [
                  {
                    tag: "list",
                    attrs: {
                      v: "2",
                      type: "product_list"
                    }
                  }
                ]
              }
            ]
          }
        );
  
        console.log(`Relay message result:`, result);
        if (result) {
          resolve({
            status: true,
            message: "Options list message sent successfully",
            result
          });
        } else {
          resolve({
            status: false,
            message: "Error sending options list message: No result returned"
          });
        }
      } catch (error) {
        console.error(`Error in sendOptionsList [${phone}]:`, error);
        resolve({
          status: false,
          message: "Error sending options list message",
          error: error.message || "Unknown error"
        });
      }
    });
  }

  /**
   * Send a WhatsApp "Product List" interactive message (ListMessage + PRODUCT_LIST).
   * Expected data shape:
   * {
   *   text, title, footer, buttonText,
   *   businessOwnerJid,
   *   productList: [{ title: string, products: [{ productId: string }] }]
   * }
   */
  async sendProductListMessage(phone, data = {}) {
    return new Promise(async (resolve) => {
      try {
        const { exists, jid } = await this.validateWhatsAppId(phone);
        if (!exists) {
          resolve({ status: false, message: "Invalid phone number or not registered on WhatsApp", jid });
          return;
        }

        const text = (data?.text || "").toString();
        const title = (data?.title || "Products").toString();
        const footer = (data?.footer || "").toString();
        const buttonText = (data?.buttonText || "View").toString();
        const businessOwnerJid = (data?.businessOwnerJid || "").toString();
        const thumbnailUrl = (data?.thumbnail || "").toString();

        const sectionsRaw = Array.isArray(data?.productList) ? data.productList : [];
        const productSections = sectionsRaw
          .map((s) => {
            const st = (s?.title || "").toString();
            const products = Array.isArray(s?.products)
              ? s.products
                  .map((p) => ({ productId: (p?.productId || "").toString() }))
                  .filter((p) => !!p.productId)
              : [];
            if (!st || products.length === 0) return null;
            return { title: st, products };
          })
          .filter(Boolean);

        if (!productSections.length) {
          resolve({ status: false, message: "No products configured for product list" });
          return;
        }

        let headerImage;
        try {
          if (thumbnailUrl) {
            const buf = await this.fetchMediaBuffer(thumbnailUrl);
            if (buf && buf.length) {
              const jpegThumbnail = await sharp(buf)
                .resize(96, 96, { fit: 'cover' })
                .jpeg({ quality: 60 })
                .toBuffer();

              const firstProductId =
                productSections?.[0]?.products?.[0]?.productId ||
                undefined;

              headerImage = proto.Message.ListMessage.ProductListHeaderImage.create({
                productId: firstProductId,
                jpegThumbnail
              });
            }
          }
        } catch (e) {
          // If thumbnail fails, continue without it.
          headerImage = undefined;
        }

        const menuMessage = {
          messageContextInfo: {
            deviceListMetadataVersion: 2,
            deviceListMetadata: {}
          },
          listMessage: proto.Message.ListMessage.create({
            title,
            description: text,
            buttonText,
            footerText: footer,
            listType: 2,
            productListInfo: proto.Message.ListMessage.ProductListInfo.create({
              businessOwnerJid: businessOwnerJid || undefined,
              ...(headerImage ? { headerImage } : {}),
              productSections: productSections.map((ps) =>
                proto.Message.ListMessage.ProductSection.create({
                  title: ps.title,
                  products: ps.products.map((p) => proto.Message.ListMessage.Product.create({ productId: p.productId }))
                })
              )
            })
          })
        };

        const result = await this.sock.relayMessage(jid, menuMessage, {
          messageId: generateMessageID(),
          additionalNodes: [
            {
              tag: "biz",
              attrs: {},
              content: [
                {
                  tag: "list",
                  attrs: { v: "2", type: "product_list" }
                }
              ]
            }
          ]
        });

        if (result) {
          resolve({ status: true, message: "Product list sent successfully", result });
        } else {
          resolve({ status: false, message: "Error sending product list: No result returned" });
        }
      } catch (error) {
        console.error(`Error in sendProductListMessage [${phone}]:`, error);
        resolve({ status: false, message: "Error sending product list", error: error.message || "Unknown error" });
      }
    });
  }

  /**
   * Fetch WhatsApp Business catalog (products + collections) for this logged-in number.
   * Used by bot-flow Catalog node to pick products/collections in the UI.
   */
  async fetchBusinessCatalogSnapshot() {
    const IQ_MS = Number(process.env.WA_CATALOG_IQ_TIMEOUT_MS || 22000);

    const withTimeout = async (promise, ms, label) => {
      let t;
      try {
        return await Promise.race([
          promise,
          new Promise((_, reject) => {
            t = setTimeout(() => reject(new Error(`${label}: ${ms}ms timeout`)), ms);
          }),
        ]);
      } finally {
        clearTimeout(t);
      }
    };

    try {
      if (!this.sock) {
        return { status: false, message: "WhatsApp not connected for this instance" };
      }
      if (!this.connected) {
        return { status: false, message: "Instance is not connected" };
      }
      if (typeof this.sock.getCatalog !== "function") {
        return { status: false, message: "Business catalog API not available on this client" };
      }

      // Parallel IQ calls; each capped so the HTTP handler never hangs on WA servers.
      const catalogPromise = withTimeout(this.sock.getCatalog({ limit: 50 }), IQ_MS, "getCatalog");
      const collectionsPromise =
        typeof this.sock.getCollections === "function"
          ? withTimeout(this.sock.getCollections(undefined, 40), IQ_MS, "getCollections")
          : Promise.resolve({ collections: [] });

      const [catSettled, collSettled] = await Promise.allSettled([catalogPromise, collectionsPromise]);

      if (catSettled.status !== "fulfilled") {
        const err = catSettled.reason;
        const msg = err?.message || String(err);
        const timedOut = /timeout/i.test(msg);
        return {
          status: false,
          message: timedOut
            ? "WhatsApp catalog (getCatalog) timeout — Business catalog slow/unavailable ya account par catalog nahi hai."
            : msg,
        };
      }

      const catalogRes = catSettled.value;

      let collectionsRes = { collections: [] };
      if (collSettled.status === "fulfilled") {
        collectionsRes = collSettled.value || { collections: [] };
      } else {
        console.warn(`getCollections failed for instance ${this.id}:`, collSettled.reason?.message);
      }

      let collections = (collectionsRes.collections || []).map((c) => ({
        id: c.id,
        name: (c.name || c.id || "Collection").toString(),
        products: (c.products || []).map((p) => ({
          id: p.id,
          name: (p.name || "").toString(),
          price: p.price,
          currency: p.currency,
          description: (p.description || "").slice(0, 500),
        })),
      }));

      const products = (catalogRes.products || []).map((p) => ({
        id: p.id,
        name: (p.name || "").toString(),
        price: p.price,
        currency: p.currency,
        description: (p.description || "").slice(0, 500),
      }));

      return {
        status: true,
        collections,
        products,
        nextPageCursor: catalogRes.nextPageCursor,
      };
    } catch (error) {
      console.error(`fetchBusinessCatalogSnapshot [${this.id}]:`, error);
      const msg = error.message || "Failed to fetch WhatsApp catalog";
      const timedOut = /timeout/i.test(msg);
      return {
        status: false,
        message: timedOut
          ? "WhatsApp se catalog response time par nahi aaya (timeout). Business account / catalog enable hai ya nahi check karo, thodi der baad retry karo."
          : msg,
      };
    }
  }

  // Add the fetchMediaBuffer method if it doesn't exist
  fetchMediaBuffer = async (url) => {
    const { buffer } = await resolveMediaSource(url);
    return buffer;
  };

  // Add the sendCarousel method
  async sendCarousel(phone, message, footer, carousel) {
    return new Promise(async (resolve) => {
      try {
        const { exists, jid } = await this.validateWhatsAppId(phone);
        
        if (!exists) {
          resolve({
            status: false,
            message: "Invalid phone number or not registered on WhatsApp",
            jid: jid
          });
          return;
        }

        if (!Array.isArray(carousel) || carousel.length === 0) {
          throw new Error("carousel must be a non-empty array");
        }

        const cards = await Promise.all(carousel.map(async (card, index) => {
          if (!card.media) {
            throw new Error(`Card at index ${index} is missing required property (media)`);
          }

          let mediaBuffer = await this.fetchMediaBuffer(card.media);
          const mimeType = card.mimeType || 'image/jpeg'; // Default to image if not specified

          // For "tall" media, preprocess image to show full (contain + padding).
          // WhatsApp carousel doesn't expose a direct size/fit option; this increases the chance
          // that the full image is visible instead of being cropped.
          const mediaSize = (card.mediaSize || 'medium').toString();
          if (mimeType.startsWith('image/') && mediaSize === 'tall') {
            try {
              mediaBuffer = await sharp(mediaBuffer)
                .resize({
                  width: 960,
                  height: 960,
                  fit: 'contain',
                  background: { r: 11, g: 11, b: 15, alpha: 1 }
                })
                .jpeg({ quality: 85 })
                .toBuffer();
            } catch (e) {
              // If sharp fails, fall back to original buffer.
            }
          }
          
          const media = await prepareWAMessageMedia(
            { 
              [mimeType.startsWith("image/") ? "image" : 
               mimeType.startsWith("video/") ? "video" : "document"]: mediaBuffer 
            },
            { upload: this.sock.waUploadToServer }
          );

          const buttons = (card.buttons || []).map((button) => {
            if (button.type === BUTTON_TYPES.URL) {
              if (!button.label || !button.url) {
                throw new Error(`URL button in card ${index} missing label or url`);
              }
              return {
                name: "cta_url",
                buttonParamsJson: JSON.stringify({
                  display_text: button.label,
                  url: button.url
                })
              };
            } else if (button.type === BUTTON_TYPES.REPLY) {
              if (!button.label) {
                throw new Error(`REPLY button in card ${index} missing label`);
              }
              return {
                name: "quick_reply",
                buttonParamsJson: JSON.stringify({
                  display_text: button.label,
                  id: button.id || `reply_${index}_${Math.random().toString(36).substr(2, 9)}`
                })
              };
            } else if (button.type === BUTTON_TYPES.Call) {
              if (!button.label || !button.phone) {
                throw new Error(`CALL button in card ${index} missing label or phone`);
              }
              return {
                name: "cta_call",
                buttonParamsJson: JSON.stringify({
                  display_text: button.label,
                  phone_number: `+${button.phone}`
                })
              };
            } else if (button.type === BUTTON_TYPES.Copy) {
              if (!button.label || !button.copy_code) {
                throw new Error(`COPY button in card ${index} missing label or copy_code`);
              }
              return {
                name: "cta_copy",
                buttonParamsJson: JSON.stringify({
                  display_text: button.label,
                  copy_code: button.copy_code
                })
              };
            } else {
              throw new Error(`Unsupported button type: ${button.type} in card ${index}`);
            }
          });

          if (buttons.length > 3) {
            throw new Error(`Card at index ${index} exceeds maximum of 3 buttons`);
          }

          const headerTitle = (card.title || card.text || "").toString();
          const bodyText = (card.description || card.text || "").toString();
          const footerText = (card.footer || "").toString();

          return {
            header: proto.Message.InteractiveMessage.Header.create({
              title: headerTitle,
              hasMediaAttachment: true,
              [mimeType.startsWith("image/") ? "imageMessage" : 
               mimeType.startsWith("video/") ? "videoMessage" : "documentMessage"]: 
                media[mimeType.startsWith("image/") ? "imageMessage" : 
                      mimeType.startsWith("video/") ? "videoMessage" : "documentMessage"]
            }),
            body: proto.Message.InteractiveMessage.Body.create({
              text: bodyText
            }),
            footer: proto.Message.InteractiveMessage.Footer.create({
              text: footerText || "© WhatsApp Bot"
            }),
            nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
              buttons: buttons
            })
          };
        }));

        console.log("carousel cards:", cards);

        const msg = generateWAMessageFromContent(
          jid,
          {
            viewOnceMessage: {
              message: {
                messageContextInfo: {
                  deviceListMetadata: {},
                  deviceListMetadataVersion: 2
                },
                interactiveMessage: proto.Message.InteractiveMessage.create({
                  body: proto.Message.InteractiveMessage.Body.create({
                    text: message || ""
                  }),
                  footer: proto.Message.InteractiveMessage.Footer.create({
                    text: footer || ""
                  }),
                  carouselMessage: proto.Message.InteractiveMessage.CarouselMessage.create({
                    cards: cards
                  })
                })
              }
            }
          },
          {
            userJid: this.sock.user?.id || jid
          }
        );

        console.log("msg:", msg);

        // Show "typing" while building/sending the carousel payload.
        await this.presenceUpdate(jid, 'composing');

        const result = await this.sock.relayMessage(
          msg.key.remoteJid,
          msg.message,
          {
            messageId: msg.key.id,
            additionalNodes
          }
        );

        if (result) {
          resolve({
            status: true,
            message: "Carousel message sent successfully",
            result: result
          });
        } else {
          resolve({
            status: false,
            message: "Error sending carousel message"
          });
        }
      } catch (error) {
        console.error(`Error in sendCarousel [${phone}]:`, error);
        resolve({
          status: false,
          message: "Error sending carousel message",
          error: error.message || "Unknown error"
        });
      }
    });
  }

}

module.exports = WhatsAppInstance;  