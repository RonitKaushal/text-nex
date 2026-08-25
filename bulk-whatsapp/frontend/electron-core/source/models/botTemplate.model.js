const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const botTemplateSchema = new Schema(
  {
    instanceId: {
      type: Schema.Types.ObjectId,
      ref: "Instance",
      required: true,
    },
    key: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ["TEXT", "IMAGE", "AUDIO", "DOCUMENT"],
      default: "TEXT",
    },
    text: {
      type: String,
    },
    mediaUrl: {
      type: String,
    },
    fileName: {
      type: String,
    },
    enabled: {
      type: Boolean,
      default: true,
    },
    order: {
      type: Number,
      default: 1,
    },
  },
  {
    timestamps: true,
  }
);

botTemplateSchema.index({ instanceId: 1, key: 1 }, { unique: true });

const BotTemplate = mongoose.model("BotTemplate", botTemplateSchema);
module.exports = BotTemplate;

