import express from 'express';
import { register, login, me } from '../controllers/authController';
import { validate } from '../middleware/validate';
import { authenticateToken } from '../middleware/auth';
import { registerSchema, loginSchema } from '../validations/schemas';

const router = express.Router();

router.post('/register', validate({ body: registerSchema }), register);
router.post('/login', validate({ body: loginSchema }), login);
router.get('/me', authenticateToken, me);

export default router;
