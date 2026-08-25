const sio = require("socket.io");

let io = null;

module.exports = {
  // Initialize the socket server
  initialize: function (httpServer) {
    const allowedOrigins = process.env.FRONTEND_URL 
      ? process.env.FRONTEND_URL.split(',').map(url => url.trim()) 
      : ["http://localhost:3000"];
    io = sio(httpServer, {
      pingTimeout: 60000,
      cors: {
        origin: allowedOrigins,
        credentials: true,
        methods: ["GET", "POST"],
      },
    });

    // Use authentication middleware
    io.use(require("../middleware/io.user.auth.middleware.js"));

    io.on("connection", function (socket) {
      console.log("//////////////////////////////////////////// socket //////////////////////////////////////////////////////////////////////////////////////////////////")
      console.log("New client connected with id =", socket.id);
      console.log("User:", socket.user?.phone || socket.user?._id || "unknown");
      
      const userId = socket.user?._id?.toString();
      if (!userId) {
        console.warn("Socket connected without userId; disconnecting.");
        socket.disconnect(true);
        return;
      }
      console.log("Socket userID:", userId);

      // Join user to their own room
      socket.join(userId);

      // Handle ping-pong for connection testing
      socket.on("ping", (data) => {
        console.log("ping: ", JSON.stringify(data));
        io.to(userId).emit("pong", { status: true, message: "Pong" });
      });

      // Handle secret message (keeping your existing functionality)
      socket.on("secret", (data) => {
        console.log("secret: ", JSON.stringify(data));
        io.to(userId).emit("secret", `Hello, ${socket.user?.phone || "user"}!`);
      });

      // Handle campaign tracking events
      socket.on("join-campaign", (data) => {
        const { campaignId } = data;
        if (campaignId) {
          socket.join(`campaign-${campaignId}`);
          console.log(`User ${userId} joined campaign room: campaign-${campaignId}`);
        }
      });

      socket.on("leave-campaign", (data) => {
        const { campaignId } = data;
        if (campaignId) {
          socket.leave(`campaign-${campaignId}`);
          console.log(`User ${userId} left campaign room: campaign-${campaignId}`);
        }
      });

      // Handle disconnect
      socket.on("disconnect", function (reason) {
        console.log(
          "A client disconnected with id = ",
          socket.id,
          " reason ==> ",
          reason
        );
      });
    });

    console.log("Socket.io server initialized successfully");
    return io;
  },

  // Return the io instance
  getInstance: function () {
    return io;
  },

  // Get IO instance (alias for getInstance)
  getIO: function () {
    return io;
  },

  // Emit campaign progress to specific user
  emitCampaignProgress: function (userId, data) {
    if (io) {
      io.to(userId.toString()).emit('campaign.progress', data);
      console.log(`Campaign progress emitted to user ${userId}:`, {
        campaignId: data.campaignId,
        sent: data.sent,
        total: data.total,
        status: data.status,
        lastMessageStatus: data.lastMessageStatus,
        lastRecipient: data.lastRecipient
      });
    }
  },

  // Emit campaign completion to specific user
  emitCampaignComplete: function (userId, data) {
    if (io) {
      io.to(userId.toString()).emit('campaign.complete', data);
      console.log(`Campaign completion emitted to user ${userId}:`, {
        campaignId: data.campaignId,
        status: data.status,
        sent: data.sent
      });
    }
  },

  // Emit to campaign room (for future use if needed)
  emitToCampaign: function (campaignId, event, data) {
    if (io) {
      io.to(`campaign-${campaignId}`).emit(event, data);
      console.log(`Event ${event} emitted to campaign room: campaign-${campaignId}`);
    }
  },

  // Emit QR code to specific user (keeping existing functionality)
  emitQR: function (userId, qrData) {
    if (io) {
      io.to(userId.toString()).emit('qr', qrData);
      console.log(`QR code emitted to user ${userId}`);
    }
  },

  // Emit connection status to specific user (keeping existing functionality)
  emitConnectionStatus: function (userId, statusData) {
    if (io) {
      io.to(userId.toString()).emit('connection-status', statusData);
      console.log(`Connection status emitted to user ${userId}:`, statusData.status);
    }
  }
};
