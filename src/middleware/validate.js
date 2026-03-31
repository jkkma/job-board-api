const { z } = require('zod');

const validate = (schema) => (req, res, next) => {
  try {
    const validated = schema.parse(req.body);
    req.body = validated;
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        issues: error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message
        }))
      });
    }

    // Fallback for any other unexpected error
    console.error('Validation middleware error:', error);
    return res.status(400).json({
      error: 'Invalid request data'
    });
  }
};

module.exports = { validate };