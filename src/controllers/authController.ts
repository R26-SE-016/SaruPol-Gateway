import { Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { findUserByEmail, findUserById, createUser } from '../config/db';
import { AuthenticatedRequest } from '../middleware/authMiddleware';

const JWT_SECRET = process.env.JWT_SECRET || 'sarupol_super_secret_key_2026';

export const register = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { name, email, password, role, estate_id, phone, district } = req.body;

  if (!name || !email || !password) {
    res.status(400).json({ error: 'Name, email, and password are required' });
    return;
  }

  try {
    const cleanEmail = email.trim().toLowerCase();

    // Check if user already exists
    const existing = await findUserByEmail(cleanEmail);
    if (existing) {
      res.status(400).json({ error: 'Email already exists' });
      return;
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user in Firestore / SQLite
    const newUser = await createUser({
      name: name.trim(),
      email: cleanEmail,
      password: hashedPassword,
      role: role || 'user',
      estate_id,
      phone,
      district,
    });

    // Generate Token
    const token = jwt.sign(
      {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        estate_id: newUser.estate_id,
      },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        estate_id: newUser.estate_id,
        phone: newUser.phone,
        district: newUser.district,
        created_at: newUser.created_at,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Server error registering user: ' + err.message });
  }
};

export const login = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  try {
    const cleanEmail = email.trim().toLowerCase();
    const user = await findUserByEmail(cleanEmail);

    if (!user || !user.password) {
      res.status(400).json({ error: 'Invalid email or password' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      res.status(400).json({ error: 'Invalid email or password' });
      return;
    }

    // Generate Token
    const token = jwt.sign(
      {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        estate_id: user.estate_id,
      },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        estate_id: user.estate_id,
        phone: user.phone,
        district: user.district,
        created_at: user.created_at,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Server error during login: ' + err.message });
  }
};

export const getProfile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user || !req.user.id) {
    res.status(401).json({ error: 'Unauthorized access' });
    return;
  }

  try {
    const user = await findUserById(String(req.user.id));
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.status(200).json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        estate_id: user.estate_id,
        phone: user.phone,
        district: user.district,
        created_at: user.created_at,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Database error fetching profile: ' + err.message });
  }
};
