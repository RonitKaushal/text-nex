const Admin = require('../models/admin.model');
const sendToken = require('../utils/jwtToken.util');

/// admin register

exports.register = async (req, res) => {
  try {
    const { username, password } = req.body;

    if(!username || !password) {
      return res.status(400).json({ message: 'Please provide username and password' });
    }

    let admin = await Admin.findOne({ username });
    if (admin) {
      return res.status(400).json({ message: 'Admin already exists' });
    }

    admin = new Admin({
      username,
      password,
      isAdmin: true
    });

    await admin.save();
    await sendToken(admin, 201, res, 'Admin registered successfully');
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/// admin login

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if(!username || !password) {
      return res.status(400).json({ message: 'Please provide username and password' });
    }

    const admin = await Admin.findOne({ username });
    if (!admin) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    await sendToken(admin, 200, res, 'Login successful');
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

