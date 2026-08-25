const User = require('../models/user.model');
const License = require('../models/license.model');
const sendToken = require('../utils/jwtToken.util');



exports.getStatistics = async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await User.findById(userId);
        const now = new Date();
        const licenseExpired = !user?.licenseExpiry || new Date(user.licenseExpiry) < now;

        res.status(200).json({
            status: true,
            statistics: {
                totalMessages: 0,
                connectedInstances: 0,
                disconnectedInstances: 0,
                totalInstances: 0,
                totalTemplates: 0,
                autoReply: 0,
                welcomeMessages: 0,
                totalCampaigns: 0,
                delivered: 0,
                failed: 0,
                pending: 0,
                paused: 0,
                cancelled: 0,
                invalid: 0,
                instanceDisconnected: 0,
                totalReceivedMessages: 0,
                licenseExpired
            },
            licenseExpired
        });
    } catch (error) {
        console.error("Error getting statistics:", error);
        res.status(500).json({ status: false, message: error.message });
    }
};

exports.loginWithLicense = async (req, res) => {
    try {
        const { licenseKey, phone, deviceType } = req.body;

        if (!licenseKey) {
            return res.status(400).json({ message: 'Please provide a license key' });
        }

        if (!deviceType || (deviceType !== 'software' && deviceType !== 'mobile')) {
             return res.status(400).json({ message: 'Valid device type (software/mobile) is required.' });
        }

        const license = await License.findOne({ key: licenseKey });

        if (!license) {
            return res.status(400).json({ message: 'Invalid License Key' });
        }

        // SCENARIO 1: License is already used
        if (license.isUsed) {
            // Check expiry
            if (new Date() > license.expiresAt) {
                return res.status(403).json({ message: 'License Expired. Please renew.', isExpired: true });
            }

            // Find associated user (Strict binding)
            // "Bind license to ONE user only"
            const user = await User.findById(license.user);

            if (!user) {
                return res.status(500).json({ message: 'License is used but no user found. Contact support.' });
            }

            // CHECK AND UPDATE DEVICE LOCKS
            if (deviceType === 'software') {
                if (user.software) {
                    return res.status(403).json({ message: 'License already used on a Software device. Login denied.' });
                }
                if (user.mobile && !user.allowBoth) {
                    return res.status(403).json({ message: 'License already active on Mobile. Cross-platform disabled.' });
                }
                user.software = true;
            } else if (deviceType === 'mobile') {
                if (user.mobile) {
                    return res.status(403).json({ message: 'License already used on a Mobile device. Login denied.' });
                }
                if (user.software && !user.allowBoth) {
                    return res.status(403).json({ message: 'License already active on Software. Cross-platform disabled.' });
                }
                user.mobile = true;
            }
            await user.save();
            
            return sendToken(user, 200, res, 'Login successful');
        }

        // SCENARIO 2: License is UNUSED (Activation)
        if (!phone) {
             return res.status(400).json({ message: 'Please provide Phone number for first-time activation.' });
        }

        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + license.duration);

        // 1. Create or Update User
        // "Create or update user" - Check if phone exists
        let user = await User.findOne({ phone });

        if (user) {
            // Update existing user with new license
            user.licenseKey = licenseKey;
            user.licenseExpiry = expiryDate;
            user.isActive = true;
            // Reset locks for new license? 
            // The user says "same phone or lickey".
            // If it's a NEW license key, we probably should reset the locks?
            // "software true hone ke bad dusra device mein loging nhi ker sakta same phone or lickey se"
            // If I buy a NEW license, I should be able to use it.
            // But here the user object persists.
            // If I reuse the user object, I should probably reset `software` and `mobile` because this is a RE-ACTIVATION with a NEW KEY.
            // However, the prompt implies "same phone or lickey".
            // If I use the SAME license key, Scenario 1 handles it.
            // If I use a DIFFERENT license key on the SAME phone (Scenario 2 with existing user):
            // Should I reset `software` and `mobile`?
            // Usually yes, a new license implies a fresh start.
            // But let's be safe. If I overwrite `licenseKey`, I should probably reset usage flags.
            // Let's reset them to be safe, as it's a new "subscription".
            user.software = false;
            user.mobile = false;
            
            await user.save();
        } else {
            // Create new user
            user = await User.create({
                phone,
                licenseKey: licenseKey,
                licenseExpiry: expiryDate,
                isActive: true
                // software/mobile default to false
            });
        }

        // APPLY LOCKS FOR THIS LOGIN
        if (deviceType === 'software') {
            user.software = true;
        } else if (deviceType === 'mobile') {
            user.mobile = true;
        }
        await user.save();

        // 2. Activate License
        license.isUsed = true;
        license.activatedAt = new Date();
        license.expiresAt = expiryDate;
        license.user = user._id; // Bind license to this user
        await license.save();

        sendToken(user, 200, res, 'License Activated & Login Successful');

    } catch (error) {
        console.error('License Login error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

const generateLicenseKey = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const segment = () => Array.from({length: 4}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    return `${segment()}-${segment()}-${segment()}-${segment()}`;
};

exports.createLicense = async (req, res) => {
    try {
        const { key, duration } = req.body;
        // Use provided key or generate one with the pattern XXXX-XXXX-XXXX-XXXX
        const licenseKey = key || generateLicenseKey();

        const license = await License.create({
            key: licenseKey,
            duration: duration || 30
        });
        res.status(201).json({ success: true, license });
    } catch (error) {
        res.status(500).json({ message: 'Error creating license', error: error.message });
    }
};

exports.renewLicense = async (req, res) => {
    try {
        const { licenseKey } = req.body;
        const userId = req.user.id; // From protect middleware

        if (!licenseKey) {
            return res.status(400).json({ message: 'Please provide a license key' });
        }

        const license = await License.findOne({ key: licenseKey });

        if (!license) {
            return res.status(400).json({ message: 'Invalid License Key' });
        }

        if (license.isUsed) {
            return res.status(400).json({ message: 'This license key has already been used.' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Calculate new expiry
        const now = new Date();
        let currentExpiry = user.licenseExpiry ? new Date(user.licenseExpiry) : now;
        
        // If expired, start from now. If active, start from current expiry.
        if (currentExpiry < now) {
            currentExpiry = now;
        }

        const newExpiry = new Date(currentExpiry);
        newExpiry.setDate(newExpiry.getDate() + license.duration);

        // Update User
        // We do NOT change licenseKey on user if it's a renewal, 
        // or maybe we should? The user prompt implies just extending time.
        // "renew kerunga to phele ki or abhi ki mix ho jayegi"
        // Usually, we might want to keep a record of the *current* active license key,
        // but for renewal, the "active" key is the one that gave the time? 
        // Or maybe we just update the expiry. 
        // Let's just update the expiry and keep the old key or update to new key?
        // Updating to new key is safer for debugging "which key is active".
        user.licenseKey = licenseKey; 
        user.licenseExpiry = newExpiry;
        user.isActive = true;
        await user.save();

        // Update License
        license.isUsed = true;
        license.activatedAt = new Date();
        license.expiresAt = newExpiry;
        license.user = user._id;
        await license.save();

        res.status(200).json({ 
            success: true, 
            message: 'License renewed successfully', 
            licenseExpiry: newExpiry 
        });

    } catch (error) {
        console.error('Renew License error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

exports.getProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const licenses = await License.find({ user: user._id }).sort({ createdAt: -1 });
        const now = new Date();

        let mappedLicenses = licenses.map(license => {
            const effectiveExpireAt = license.expiresAt || user.licenseExpiry || null;
            const isExpired = effectiveExpireAt ? effectiveExpireAt < now : false;
            const status = isExpired ? 'expired' : (license.isUsed ? 'active' : 'pending');

            return {
                id: license._id,
                key: license.key,
                type: 'paid',
                status,
                activateAt: license.activatedAt,
                expireAt: effectiveExpireAt,
                valid: license.duration,
                isExpired,
                createdAt: license.createdAt
            };
        });

        // Fallback for older users where License documents may not have expiresAt set
        if (mappedLicenses.length === 0 && user.licenseExpiry) {
            const fallbackExpireAt = user.licenseExpiry;
            const isExpired = fallbackExpireAt < now;

            mappedLicenses = [
                {
                    id: `legacy-${user._id}`,
                    key: user.licenseKey || 'UNKNOWN',
                    type: 'paid',
                    status: isExpired ? 'expired' : 'active',
                    activateAt: user.createdAt,
                    expireAt: fallbackExpireAt,
                    valid: null,
                    isExpired,
                    createdAt: user.createdAt
                }
            ];
        }

        const activeLicense = mappedLicenses.find(l => !l.isExpired && l.status === 'active') || mappedLicenses[0] || null;

        const licenseExpired = !user.licenseExpiry || user.licenseExpiry < now;

        const profile = {
            id: user._id,
            email: '',
            phone: user.phone,
            isActive: user.isActive,
            instances: Number.isFinite(user.instances) ? user.instances : 10,
            allowBoth: Boolean(user.allowBoth),
            software: Boolean(user.software),
            mobile: Boolean(user.mobile),
            device: {
                deviceId: '',
                deviceType: 'software',
                ip: '',
                lastActive: user.updatedAt
            },
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
            activeLicense,
            allLicenses: mappedLicenses,
            licenseExpired
        };

        res.status(200).json({
            success: true,
            user: profile,
            licenseExpired
        });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};
