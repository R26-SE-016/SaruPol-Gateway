import { Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../config/db';
import { AuthenticatedRequest } from '../middleware/authMiddleware';

const JWT_SECRET = process.env.JWT_SECRET || 'sarupol_super_secret_key_2026';

export const register = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    res.status(400).json({ error: 'Name, email, and password are required' });
    return;
  }

  try {
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Insert user into SQLite
    db.run(
      `INSERT INTO users (name, email, password) VALUES (?, ?, ?)`,
      [name, email, hashedPassword],
      function (err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            res.status(400).json({ error: 'Email already exists' });
          } else {
            res.status(500).json({ error: 'Database error registering user: ' + err.message });
          }
          return;
        }

        // Generate Token
        const token = jwt.sign(
          { id: this.lastID, name, email, role: 'user' },
          JWT_SECRET,
          { expiresIn: '30d' }
        );

        res.status(201).json({
          message: 'User registered successfully',
          token,
          user: {
            id: this.lastID,
            name,
            email,
            role: 'user'
          }
        });
      }
    );
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

  db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, user: any) => {
    if (err) {
      res.status(500).json({ error: 'Database query error: ' + err.message });
      return;
    }

    if (!user) {
      res.status(400).json({ error: 'Invalid email or password' });
      return;
    }

    try {
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        res.status(400).json({ error: 'Invalid email or password' });
        return;
      }

      // Generate Token
      const token = jwt.sign(
        { id: user.id, name: user.name, email: user.email, role: user.role },
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
          role: user.role
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Server error during login: ' + err.message });
    }
  });
};

export const getProfile = (req: AuthenticatedRequest, res: Response): void => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized access' });
    return;
  }

  db.get(
    `SELECT id, name, email, role, created_at FROM users WHERE id = ?`,
    [req.user.id],
    (err, user: any) => {
      if (err) {
        res.status(500).json({ error: 'Database error fetching profile: ' + err.message });
        return;
      }

      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      res.status(200).json({ user });
    }
  );
};
