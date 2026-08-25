const { asyncForEach } = require('../utils/common.util');
const { MESSAGE_COLUMNS, RECIPIENT_STATUS, MESSAGE_STATUS } = require('../utils/enums');
const socket = require('./socket.io');
const Message = require('../models/message.model');

class CampaignProcessor {
  constructor(campaignId, userId) {
    this.campaignId = campaignId;
    this.userId = userId;
    this.waInstances = new Map();
    this.availableInstances = [];
    this.template = null;
    this.delayRange = { start: 5, end: 10 };
    this.io = socket.getIO();
    
    // 🎯 Enhanced Round-Robin with Smart Distribution
    this.currentInstanceIndex = 0;
    this.instanceUsageCount = new Map();
    this.baseDelayMs = 5000;
    
    // Smart refresh and rate limiting
    this.lastRefreshTime = 0;
    this.refreshCooldown = 5000;
    this.isRefreshing = false;
    
    // Anti-ban measures
    this.messagesPerInstance = new Map();
    this.instanceCooldowns = new Map();
    this.maxMessagesPerInstancePerHour = 50;
    this.instanceCooldownTime = 300000;
    this.globalRateLimit = 1000;
    this.lastGlobalMessageTime = 0;
  }

  async initialize(pendingRecipients, connectedInstanceDocs, campaign) {
    this.pendingRecipients = pendingRecipients;
    this.template = campaign.templateId;
    this.delayRange = campaign.settings?.delayRange || campaign.delayRange || { start: 5, end: 10 };
    this.availableInstances = [...connectedInstanceDocs];
    
    console.log(`🚀 Initializing with ${this.availableInstances.length} instances:`, 
      this.availableInstances.map(inst => inst._id.toString().slice(-4)));
    
    // 🚀 Initialize tracking maps with functional approach
    await Promise.all(
      this.availableInstances.map(instance => {
        const instanceId = instance._id.toString();
        this.instanceUsageCount.set(instanceId, 0);
        this.messagesPerInstance.set(instanceId, { count: 0, resetTime: Date.now() + 3600000 });
        console.log(`📊 Initialized instance ${instanceId.slice(-4)} for round-robin`);
        return Promise.resolve();
      })
    );
    
    await this.refreshInstances(true);

    // If docs were passed but socket not open yet, poll briefly before failing hard
    if (this.availableInstances.length === 0 && (connectedInstanceDocs || []).length) {
      this.availableInstances = [...connectedInstanceDocs];
      const deadline = Date.now() + 45000;
      while (Date.now() < deadline) {
        await this.refreshInstances(true);
        if (this.availableInstances.length > 0) break;
        console.log('⏳ Waiting for WhatsApp connection to open before sending...');
        await new Promise((r) => setTimeout(r, 1500));
        // keep trying the original docs
        if (this.availableInstances.length === 0) {
          this.availableInstances = [...connectedInstanceDocs];
        }
      }
      await this.refreshInstances(true);
    }
    
    console.log(`🚀 Campaign ${this.campaignId}: ${pendingRecipients.length} recipients, ${this.availableInstances.length} instances`);
    console.log(`⚡ Anti-ban mode: Max ${this.maxMessagesPerInstancePerHour} msgs/instance/hour`);
    console.log(`🔄 Round-robin will cycle through all ${this.availableInstances.length} instances`);
    return this;
  }

  getConnectedInstance(instanceId) {
    try {
      const sessions = require('./sessions');
      const instance = sessions.get(instanceId.toString());
      if (instance?.connected && instance?.sock) {
        return instance;
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  async refreshInstances(force = false) {
    const now = Date.now();
    
    if (!force && (this.isRefreshing || (now - this.lastRefreshTime) < this.refreshCooldown)) {
      return this.availableInstances;
    }

    this.isRefreshing = true;
    this.lastRefreshTime = now;

    try {
      console.log(`🔄 Refreshing instances... Current count: ${this.availableInstances.length}`);
      
      // 🚀 Parallel instance health check with Promise.all
      const instanceChecks = await Promise.all(
        this.availableInstances.map(async (instanceDoc) => {
          const instanceId = instanceDoc._id.toString();
          const waInstance = this.getConnectedInstance(instanceDoc._id);
          
          // Require fully open connection (connected flag), not just sock
          if (waInstance?.connected && waInstance?.sock && !this.isInstanceInCooldown(instanceId)) {
            this.waInstances.set(instanceId, waInstance);
            console.log(`✅ Instance ${instanceId.slice(-4)} is available`);
            return instanceDoc;
          } else {
            this.waInstances.delete(instanceId);
            console.log(`❌ Instance ${instanceId.slice(-4)} is not available`, {
              hasInstance: !!waInstance,
              connected: !!waInstance?.connected,
              hasSock: !!waInstance?.sock,
            });
            return null;
          }
        })
      );

      // 🎯 Rebuild available instances with functional filter and sort
      const previousCount = this.availableInstances.length;
      this.availableInstances = instanceChecks
        .filter(Boolean)
        .sort((a, b) => a._id.toString().localeCompare(b._id.toString()));
      
      console.log(`📊 Instance refresh: ${previousCount} → ${this.availableInstances.length} available`);
      console.log(`🔄 Available instances:`, this.availableInstances.map(inst => inst._id.toString().slice(-4)));
      
      // 🔧 Smart index adjustment - CRITICAL FIX
      if (this.currentInstanceIndex >= this.availableInstances.length) {
        console.log(`🔧 Adjusting currentInstanceIndex from ${this.currentInstanceIndex} to 0 (max: ${this.availableInstances.length - 1})`);
        this.currentInstanceIndex = 0;
      }
      
      return this.availableInstances;
      
    } finally {
      this.isRefreshing = false;
    }
  }

  // 🛡️ Anti-ban: Check if instance is in cooldown
  isInstanceInCooldown(instanceId) {
    const cooldownEnd = this.instanceCooldowns.get(instanceId);
    if (cooldownEnd && Date.now() < cooldownEnd) {
      return true;
    }
    this.instanceCooldowns.delete(instanceId);
    return false;
  }

  // 🛡️ Anti-ban: Check instance rate limit
  canInstanceSendMessage(instanceId) {
    const now = Date.now();
    const instanceStats = this.messagesPerInstance.get(instanceId);
    
    if (!instanceStats) {
      this.messagesPerInstance.set(instanceId, { count: 0, resetTime: now + 3600000 });
      return true;
    }
    
    // Reset counter if hour has passed
    if (now > instanceStats.resetTime) {
      this.messagesPerInstance.set(instanceId, { count: 0, resetTime: now + 3600000 });
      return true;
    }
    
    // Check if under limit
    return instanceStats.count < this.maxMessagesPerInstancePerHour;
  }

  // 🛡️ Anti-ban: Put instance in cooldown
  putInstanceInCooldown(instanceId) {
    const cooldownEnd = Date.now() + this.instanceCooldownTime;
    this.instanceCooldowns.set(instanceId, cooldownEnd);
    console.log(`🛡️ Instance ${instanceId.slice(-4)} in cooldown for ${this.instanceCooldownTime/1000}s`);
  }

  // 🎯 FIXED Round-Robin with Proper Cycling Through ALL Instances
  selectInstance(recipientIndex) {
    if (this.availableInstances.length === 0) {
      console.log(`❌ No instances available for recipient ${recipientIndex + 1}`);
      return null;
    }

    console.log(`🎯 [${recipientIndex + 1}] Starting instance selection. Available: ${this.availableInstances.length}, Current index: ${this.currentInstanceIndex}`);
    
    const maxAttempts = this.availableInstances.length * 2; // Try each instance twice if needed
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      // 🔧 CRITICAL FIX: Ensure index is within bounds
      if (this.currentInstanceIndex >= this.availableInstances.length) {
        console.log(`🔧 Index ${this.currentInstanceIndex} out of bounds (max: ${this.availableInstances.length - 1}), resetting to 0`);
        this.currentInstanceIndex = 0;
      }
      
      const selectedInstance = this.availableInstances[this.currentInstanceIndex];
      const instanceId = selectedInstance._id.toString();
      
      console.log(`🔍 [${recipientIndex + 1}] Checking instance ${this.currentInstanceIndex + 1}/${this.availableInstances.length} (${instanceId.slice(-4)})`);
      
      // Check if instance can send message
      if (this.canInstanceSendMessage(instanceId) && !this.isInstanceInCooldown(instanceId)) {
        // Update usage count
        const currentUsage = this.instanceUsageCount.get(instanceId) || 0;
        this.instanceUsageCount.set(instanceId, currentUsage + 1);
        
        // Update messages per instance counter
        const instanceStats = this.messagesPerInstance.get(instanceId);
        instanceStats.count++;
        
        console.log(`✅ [${recipientIndex + 1}] Selected instance ${this.currentInstanceIndex + 1}/${this.availableInstances.length} (${instanceId.slice(-4)}) - Usage: ${currentUsage + 1} (${instanceStats.count}/${this.maxMessagesPerInstancePerHour})`);
        
        // 🎯 CRITICAL: Move to next instance for round-robin
        const previousIndex = this.currentInstanceIndex;
        this.currentInstanceIndex = (this.currentInstanceIndex + 1) % this.availableInstances.length;
        
        console.log(`🔄 [${recipientIndex + 1}] Round-robin: ${previousIndex} → ${this.currentInstanceIndex} (next recipient will use instance ${this.currentInstanceIndex + 1})`);
        
        return selectedInstance;
      } else {
        console.log(`⚠️ [${recipientIndex + 1}] Instance ${this.currentInstanceIndex + 1} (${instanceId.slice(-4)}) not available (rate limited or cooldown)`);
      }
      
      // Move to next instance and try again
      this.currentInstanceIndex = (this.currentInstanceIndex + 1) % this.availableInstances.length;
      attempts++;
      
      console.log(`🔄 [${recipientIndex + 1}] Trying next instance: ${this.currentInstanceIndex + 1}/${this.availableInstances.length} (attempt ${attempts}/${maxAttempts})`);
    }

    console.log(`❌ [${recipientIndex + 1}] All instances are rate limited or in cooldown after ${attempts} attempts`);
    return null;
  }

  async sendMessage(recipient, instanceDoc, waInstance, recipientIndex) {
    try {
      const phone = recipient.phone.replace(/[^0-9]/g, '');
      const instanceId = instanceDoc._id.toString();
      
      console.log(`📤 [${recipientIndex + 1}] Sending to ${recipient.phone} via instance ${instanceId.slice(-4)}`);
      
      // 🛡️ Enhanced validation with timeout
      const validationPromise = waInstance.validateWhatsAppId(phone);
      const validationTimeout = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Validation timeout')), 15000);
      });
      
      let verifyResult;
      try {
        verifyResult = await Promise.race([validationPromise, validationTimeout]);
      } catch (error) {
        console.log(`❌ [${recipientIndex + 1}] Validation failed for ${phone}: ${error.message}`);
        return { status: RECIPIENT_STATUS.NOT_EXIST, error: 'Validation failed' };
      }
      
      if (!verifyResult?.exists) {
        console.log(`❌ [${recipientIndex + 1}] Number ${phone} does not exist on WhatsApp`);
        return { status: RECIPIENT_STATUS.NOT_EXIST, error: 'Number does not exist' };
      }

      const contact = {
        phone: recipient.phone,
        name: recipient.name,
        variables: recipient.variables || {}
      };

      // 🛡️ Enhanced send with better timeout and retry
      const sendPromise = waInstance.sendTemplate(contact, this.template);
      const sendTimeout = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Send timeout')), 30000);
      });
      
      const result = await Promise.race([sendPromise, sendTimeout]);
      
      if (result?.status) {
        console.log(`✅ [${recipientIndex + 1}] Message sent successfully to ${recipient.phone} via ${instanceId.slice(-4)}`);
        return { 
          status: RECIPIENT_STATUS.SENT, 
          instanceUsed: instanceDoc._id 
        };
      } else {
        console.log(`❌ [${recipientIndex + 1}] Failed to send to ${recipient.phone} via ${instanceId.slice(-4)}: ${result?.message}`);
        
        // Check if we should put instance in cooldown
        if (this.shouldCooldownInstance(result?.error)) {
          this.putInstanceInCooldown(instanceId);
        }
        
        return { 
          status: RECIPIENT_STATUS.FAILED, 
          error: result?.message || 'Send failed',
          instanceUsed: instanceDoc._id 
        };
      }

    } catch (error) {
      console.error(`❌ [${recipientIndex + 1}] Error sending to ${recipient.phone}:`, error.message);
      
      // 🎯 Smart error categorization
      const errorMessage = error.message?.toLowerCase() || '';
      
      if (errorMessage.includes('not exist') || errorMessage.includes('invalid number')) {
        return { status: RECIPIENT_STATUS.NOT_EXIST, error: error.message };
      } else if (errorMessage.includes('rate limit') || errorMessage.includes('too many')) {
        this.putInstanceInCooldown(instanceDoc._id.toString());
        return { status: RECIPIENT_STATUS.FAILED, error: error.message };
      } else if (errorMessage.includes('connection closed') || errorMessage.includes('disconnected') || errorMessage.includes('timeout')) {
        return { status: RECIPIENT_STATUS.INSTANCE_DISCONNECTED, error: error.message };
      } else {
        return { status: RECIPIENT_STATUS.FAILED, error: error.message };
      }
    }
  }

  // 🛡️ Determine if instance should be put in cooldown
  shouldCooldownInstance(errorMessage) {
    if (!errorMessage) return false;
    
    const cooldownTriggers = [
      'rate limit',
      'too many requests',
      'spam',
      'blocked',
      'restricted',
      'temporarily unavailable'
    ];
    
    return cooldownTriggers.some(trigger => 
      errorMessage.toLowerCase().includes(trigger)
    );
  }

  async updateDatabase(recipientIndex, result) {
    const statMap = new Map([
      [RECIPIENT_STATUS.SENT, 'sent'],
      [RECIPIENT_STATUS.FAILED, 'failed'],
      [RECIPIENT_STATUS.NOT_EXIST, 'notExist'],
      [RECIPIENT_STATUS.INSTANCE_DISCONNECTED, 'instanceDisconnected']
    ]);

    const update = {
      $set: {
        [`recipients.${recipientIndex}.status`]: result.status,
        [`recipients.${recipientIndex}.${result.status === RECIPIENT_STATUS.SENT ? 'sentAt' : 'failedAt'}`]: new Date(),
        ...(result.instanceUsed && { [`recipients.${recipientIndex}.instanceUsed`]: result.instanceUsed })
      },
      $inc: {}
    };

    const statKey = statMap.get(result.status);
    if (statKey) {
      update.$inc[`statistics.${statKey}`] = 1;
    }

    await Message.updateOne({ _id: this.campaignId }, update);
    return update;
  }

  async emitProgress(recipientIndex, recipient, result) {
    if (!this.io) return;

    const updatedCampaign = await Message.findById(this.campaignId).lean();
    
    const totalRecipients = updatedCampaign.recipients.length;
    const processedRecipients = recipientIndex + 1;
    const progressPercentage = Math.round((processedRecipients / totalRecipients) * 100);
    
    // Calculate more accurate ETA
    const avgDelayPerMessage = this.baseDelayMs + ((this.delayRange.start + this.delayRange.end) / 2 * 1000) + 3000;
    const remainingMessages = totalRecipients - processedRecipients;
    const estimatedTimeRemaining = Math.round((remainingMessages * avgDelayPerMessage) / 1000);
    
    // Emit individual message status update for real-time UI updates
    this.io.to(this.userId).emit('campaign.message.status', {
      campaignId: this.campaignId,
      recipientIndex,
      status: result.status,
      phone: recipient.phone,
      name: recipient.name,
      timestamp: new Date()
    });

    this.io.to(this.userId).emit('campaign.progress', {
      campaignId: this.campaignId,
      total: totalRecipients,
      processed: processedRecipients,
      sent: updatedCampaign.statistics.sent,
      failed: updatedCampaign.statistics.failed,
      notExist: updatedCampaign.statistics.notExist,
      instanceDisconnected: updatedCampaign.statistics.instanceDisconnected,
      progressPercentage,
      estimatedTimeRemaining,
      availableInstances: this.availableInstances.length,
      lastRecipient: recipient.name,
      lastRecipientPhone: recipient.phone,
      lastMessageStatus: result.status,
      lastRecipientIndex: recipientIndex,
      instanceUsageStats: Object.fromEntries(this.instanceUsageCount),
      currentRoundRobinIndex: this.currentInstanceIndex,
      delaySettings: {
        base: this.baseDelayMs / 1000,
        range: this.delayRange,
        total: `${5 + this.delayRange.start}-${5 + this.delayRange.end}s`
      },
      antiBanStats: {
        maxPerHour: this.maxMessagesPerInstancePerHour,
        cooldownTime: this.instanceCooldownTime / 1000,
        instancesInCooldown: this.instanceCooldowns.size
      }
    });
  }

  checkCampaignControl() {
    const control = globalThis.CAMPAIGN_STATES[this.campaignId];
    return {
      exists: !!control,
      isStopped: control?.isStopped || false,
      isPaused: control?.isPaused || false
    };
  }

  async handlePause() {
    console.log(`⏸️ Campaign ${this.campaignId} paused - monitoring for resume...`);
    
    return new Promise((resolve) => {
      const maxChecks = 180; // 6 minutes max
      
      // 🚀 Functional recursive approach instead of while loop
      const checkResume = (checkCount = 0) => {
        if (checkCount >= maxChecks) {
          return resolve({ timeout: true });
        }

        const control = this.checkCampaignControl();
        
        if (!control.exists || control.isStopped) {
          return resolve({ stopped: true });
        }
        
        if (!control.isPaused) {
          return this.refreshInstances(true).then(() => {
            console.log(`▶️ Campaign resumed with ${this.availableInstances.length} instances`);
            resolve({ resumed: true });
          });
        }
        
        // Check for reconnections every 10 seconds during pause
        const shouldRefresh = checkCount % 5 === 0;
        const refreshPromise = shouldRefresh 
          ? this.refreshInstances(true).then(() => {
              console.log(`🔄 Pause check ${checkCount + 1}: ${this.availableInstances.length} available`);
            })
          : Promise.resolve();
        
        refreshPromise.then(() => {
          setTimeout(() => checkResume(checkCount + 1), 2000);
        });
      };
      
      checkResume();
    });
  }

  async processMessage(recipient, recipientIndex) {
    const control = this.checkCampaignControl();
    if (!control.exists || control.isStopped) {
      return { stopped: true };
    }

    if (control.isPaused) {
      console.log(`⏸️ Campaign paused at message ${recipientIndex + 1}`);
      const pauseResult = await this.handlePause();
      if (pauseResult.stopped || pauseResult.timeout) return { stopped: true };
    }

    // 🛡️ Global rate limiting
    const now = Date.now();
    const timeSinceLastMessage = now - this.lastGlobalMessageTime;
    if (timeSinceLastMessage < this.globalRateLimit) {
      await new Promise(resolve => setTimeout(resolve, this.globalRateLimit - timeSinceLastMessage));
    }
    this.lastGlobalMessageTime = Date.now();

    // 🔄 Smart instance availability check
    if (this.availableInstances.length === 0) {
      console.log(`❌ No available instances - forcing refresh`);
      await this.refreshInstances(true);
      
      if (this.availableInstances.length === 0) {
        // Wait and try once more
        await new Promise(resolve => setTimeout(resolve, 5000));
        await this.refreshInstances(true);
        
        if (this.availableInstances.length === 0) {
          return { noInstances: true };
        }
      }
    }

    const instanceDoc = this.selectInstance(recipientIndex);
    
    if (!instanceDoc) {
      console.log(`⚠️ No instance available (all rate limited or in cooldown)`);
      // Wait for cooldowns to expire
      await new Promise(resolve => setTimeout(resolve, 30000));
      return { instanceUnavailable: true };
    }

    const waInstance = this.waInstances.get(instanceDoc._id.toString());

    if (!(waInstance?.connected || waInstance?.sock)) {
      console.log(`❌ Instance ${instanceDoc._id.toString().slice(-4)} not connected`);
      // Simply skip this instance and continue with others
      return { instanceUnavailable: true };
    }

    const result = await this.sendMessage(recipient, instanceDoc, waInstance, recipientIndex);

    await this.updateDatabase(recipientIndex, result);
    await this.emitProgress(recipientIndex, recipient, result);

    return { success: true, status: result.status };
  }

  calculateDelay() {
    const baseDelay = this.baseDelayMs;
    const randomDelayMs = this.getRandomDelay(this.delayRange.start, this.delayRange.end);
    const totalDelay = baseDelay + randomDelayMs;
    
    console.log(`⏳ Delay: ${(baseDelay / 1000).toFixed(1)}s + ${(randomDelayMs / 1000).toFixed(1)}s = ${(totalDelay / 1000).toFixed(1)}s`);
    
    return totalDelay;
  }

  getRandomDelay(start, end) {
    const min = start * 1000; 
    const max = end * 1000; 
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  // 🚀 NO LOOPS - Pure functional recursive approach
  async processNext(currentIndex) {
    if (currentIndex >= this.pendingRecipients.length) {
      return { completed: true };
    }

    const recipient = this.pendingRecipients[currentIndex];
    
    console.log(`\n🚀 [${currentIndex + 1}/${this.pendingRecipients.length}] Processing: ${recipient.name} (${recipient.phone})`);
    console.log(`🔄 Current round-robin state: index ${this.currentInstanceIndex}, available instances: ${this.availableInstances.length}`);
    
    // 🔄 Smart retry with exponential backoff using Promise chain
    const maxRetries = 3;
    const initialRetryDelay = 2000;
    
    const attemptMessage = async (retryCount = 0, retryDelay = initialRetryDelay) => {
      if (retryCount >= maxRetries) {
        return { failed: true, error: 'Max retries exceeded' };
      }

      try {
        const attemptResult = await this.processMessage(recipient, currentIndex);
        
        if (attemptResult.success || attemptResult.stopped || attemptResult.noInstances) {
          return attemptResult;
        }
        
        if (attemptResult.instanceUnavailable) {
          console.log(`🔄 Retry ${retryCount + 1}/${maxRetries} for message ${currentIndex + 1} in ${retryDelay}ms`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          return attemptMessage(retryCount + 1, retryDelay * 2); // Exponential backoff
        }
        
        return attemptResult;
        
      } catch (error) {
        console.error(`❌ Error processing message ${currentIndex + 1}, retry ${retryCount + 1}:`, error.message);
        
        if (retryCount >= maxRetries - 1) {
          return { failed: true, error: error.message };
        }
        
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return attemptMessage(retryCount + 1, retryDelay * 2);
      }
    };

    const messageResult = await attemptMessage();
    
    if (messageResult.stopped || messageResult.noInstances || messageResult.failed) {
      return messageResult;
    }

    const delay = this.calculateDelay();

    // 🚀 Functional recursive continuation with Promise
    return new Promise(resolve => {
      setTimeout(async () => {
        try {
          const nextResult = await this.processNext(currentIndex + 1);
          resolve(nextResult);
        } catch (error) {
          console.error(`❌ Error in recursive processing:`, error);
          resolve({ failed: true, error: error.message });
        }
      }, delay);
    });
  }

  async start() {
    try {
      console.log(`🚀 Starting campaign ${this.campaignId} processing...`);
      console.log(`📊 Initial: ${this.pendingRecipients.length} recipients, ${this.availableInstances.length} instances`);
      console.log(`🛡️ Anti-ban: ${this.maxMessagesPerInstancePerHour} msgs/instance/hour, ${this.instanceCooldownTime/1000}s cooldown`);
      console.log(`🔄 Round-robin will cycle through instances: ${this.availableInstances.map(inst => inst._id.toString().slice(-4)).join(', ')}`);
      
      const result = await this.processNext(0);
      
      const control = this.checkCampaignControl();
      const currentCampaign = await Message.findById(this.campaignId).lean();
      
      if (currentCampaign.status === MESSAGE_STATUS.STOP) {
        console.log(`🛑 Campaign ${this.campaignId} was stopped - keeping STOPPED status`);
        delete globalThis.CAMPAIGN_STATES[this.campaignId];
        
        if (this.io) {
          this.io.to(this.userId).emit('campaign.complete', {
            campaignId: this.campaignId,
            status: MESSAGE_STATUS.STOP,
            total: this.pendingRecipients.length,
            sent: currentCampaign.statistics.sent,
            failed: currentCampaign.statistics.failed,
            notExist: currentCampaign.statistics.notExist,
            instanceDisconnected: currentCampaign.statistics.instanceDisconnected,
            completedAt: new Date(),
            instanceUsageStats: Object.fromEntries(this.instanceUsageCount),
            totalInstancesUsed: this.availableInstances.length,
            antiBanStats: {
              maxPerHour: this.maxMessagesPerInstancePerHour,
              cooldownTime: this.instanceCooldownTime / 1000,
              finalCooldowns: this.instanceCooldowns.size
            }
          });
        }
        
        return currentCampaign;
      }
      
      const finalStatus = result.stopped || control.isStopped 
        ? MESSAGE_STATUS.STOPPED
        : result.noInstances || result.failed 
          ? MESSAGE_STATUS.FAILED 
          : MESSAGE_STATUS.COMPLETED;

      await Message.updateOne({ _id: this.campaignId }, { status: finalStatus });
      delete globalThis.CAMPAIGN_STATES[this.campaignId];

      const finalCampaign = await Message.findById(this.campaignId).lean();

      if (this.io) {
        this.io.to(this.userId).emit('campaign.complete', {
          campaignId: this.campaignId,
          status: finalStatus,
          total: this.pendingRecipients.length,
          sent: finalCampaign.statistics.sent,
          failed: finalCampaign.statistics.failed,
          notExist: finalCampaign.statistics.notExist,
          instanceDisconnected: finalCampaign.statistics.instanceDisconnected,
          completedAt: new Date(),
          instanceUsageStats: Object.fromEntries(this.instanceUsageCount),
          totalInstancesUsed: this.availableInstances.length,
          antiBanStats: {
            maxPerHour: this.maxMessagesPerInstancePerHour,
            cooldownTime: this.instanceCooldownTime / 1000,
            finalCooldowns: this.instanceCooldowns.size
          }
        });
      }

      console.log(`🎉 Campaign ${this.campaignId} ${finalStatus}:`);
      console.log(`📊 Final: ${finalCampaign.statistics.sent}/${this.pendingRecipients.length} sent`);
      console.log(`🛡️ Anti-ban stats: ${this.instanceCooldowns.size} instances in cooldown`);
      console.log(`🔄 Final instance usage:`, Object.fromEntries(this.instanceUsageCount));
      
      return finalCampaign;

    } catch (error) {
      console.error(`❌ Campaign ${this.campaignId} Error:`, error);
      await Message.updateOne({ _id: this.campaignId }, { status: MESSAGE_STATUS.FAILED });
      delete globalThis.CAMPAIGN_STATES[this.campaignId];
      throw error;
    }
  }

  static async processCampaign(campaignId, pendingRecipients, connectedInstanceDocs, campaign, userId) {
    const processor = new CampaignProcessor(campaignId, userId);
    await processor.initialize(pendingRecipients, connectedInstanceDocs, campaign);
    return await processor.start();
  }
}

module.exports = CampaignProcessor;