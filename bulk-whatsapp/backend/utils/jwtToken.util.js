const sendToken = async (user, statusCode, res, message) => {
    const token = user.getJWTToken();
    
    // Return token in JSON response only (no cookies)
    res.status(statusCode).json({
        success: true,
        message: message,
        token,
        user: {
            id: user._id,
            phone: user.phone,
            licenseKey: user.licenseKey,
            licenseExpiry: user.licenseExpiry,
            isActive: user.isActive,
            instances: Number.isFinite(user.instances) ? user.instances : 10,
            software: Boolean(user.software),
            mobile: Boolean(user.mobile),
            allowBoth: Boolean(user.allowBoth)
        }
    });
};
  
module.exports = sendToken;