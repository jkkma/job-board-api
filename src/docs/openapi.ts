/**
 * OpenAPI 3.0 description of the API, served as interactive docs at /docs and
 * as a machine-readable document at /openapi.json.
 *
 * Written as a TypeScript object rather than a separate YAML file so it is
 * type-checked, compiled into the image with everything else, and needs no
 * YAML parser at runtime.
 */

const errorResponse = (description: string, example: Record<string, unknown>) => ({
  description,
  content: {
    'application/json': {
      schema: { $ref: '#/components/schemas/Error' },
      example: { error: example },
    },
  },
});

const UNAUTHORIZED = errorResponse('Missing, malformed, or expired token', {
  code: 'UNAUTHORIZED',
  message: 'Access token required',
});

const FORBIDDEN = errorResponse('Authenticated, but not allowed to do this', {
  code: 'FORBIDDEN',
  message: 'This action requires the EMPLOYER role',
});

const NOT_FOUND = errorResponse('Resource does not exist', {
  code: 'NOT_FOUND',
  message: 'Job not found',
});

const VALIDATION_FAILED = errorResponse('Request failed schema validation', {
  code: 'VALIDATION_FAILED',
  message: 'Validation failed',
  details: [{ path: 'password', message: 'Password must be at least 8 characters' }],
});

const idPath = {
  name: 'id',
  in: 'path',
  required: true,
  schema: { type: 'string', format: 'uuid' },
};

export const openapiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Job Board API',
    version: '1.0.0',
    description:
      'Employers post jobs, applicants apply, employers accept or reject.\n\n' +
      '**Authentication.** Register, log in, then send the returned JWT as ' +
      '`Authorization: Bearer <token>`. Use the *Authorize* button above to ' +
      'set it for every request on this page.\n\n' +
      '**Errors.** Every failure returns the same envelope: ' +
      '`{ "error": { "code", "message", "details?" } }`. Branch on `code`, ' +
      'not on the message.',
    license: { name: 'MIT', url: 'https://opensource.org/licenses/MIT' },
  },
  servers: [{ url: '/api/v1', description: 'Current version' }],
  tags: [
    { name: 'Auth', description: 'Registration, login, and the current session' },
    { name: 'Jobs', description: 'Job listings. Reading is public; writing is EMPLOYER only' },
    { name: 'Applications', description: 'Applying to jobs and reviewing applicants' },
    { name: 'Health', description: 'Liveness and readiness probes (served outside /api/v1)' },
  ],

  paths: {
    '/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Create an account',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password', 'role'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 8, maxLength: 72 },
                  role: { type: 'string', enum: ['EMPLOYER', 'APPLICANT'] },
                  name: { type: 'string', maxLength: 120 },
                },
              },
              example: {
                email: 'hire@acme.com',
                password: 'password123',
                role: 'EMPLOYER',
                name: 'Acme Corp',
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Account created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string' },
                    user: { $ref: '#/components/schemas/User' },
                  },
                },
              },
            },
          },
          400: VALIDATION_FAILED,
          409: errorResponse('Email already registered', {
            code: 'CONFLICT',
            message: 'An account with that email already exists',
          }),
          429: errorResponse('Rate limit exceeded', {
            code: 'TOO_MANY_REQUESTS',
            message: 'Too many requests, please try again later',
          }),
        },
      },
    },

    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Exchange credentials for a token',
        description:
          'Returns an identical 401 for an unknown email and a wrong password, ' +
          'deliberately: distinguishing them would turn this into an ' +
          'account-enumeration endpoint.',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string' },
                },
              },
              example: { email: 'hire@acme.com', password: 'password123' },
            },
          },
        },
        responses: {
          200: {
            description: 'Authenticated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string' },
                    token: { type: 'string' },
                    user: { $ref: '#/components/schemas/User' },
                  },
                },
              },
            },
          },
          400: VALIDATION_FAILED,
          401: errorResponse('Invalid credentials', {
            code: 'UNAUTHORIZED',
            message: 'Invalid email or password',
          }),
          429: errorResponse('Rate limit exceeded', {
            code: 'TOO_MANY_REQUESTS',
            message: 'Too many requests, please try again later',
          }),
        },
      },
    },

    '/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'The current user',
        description:
          'Read from the database rather than the token claims, so a role ' +
          'changed after the token was issued is reflected here.',
        responses: {
          200: {
            description: 'The authenticated user',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { user: { $ref: '#/components/schemas/User' } },
                },
              },
            },
          },
          401: UNAUTHORIZED,
        },
      },
    },

    '/jobs': {
      get: {
        tags: ['Jobs'],
        summary: 'List active jobs',
        security: [],
        parameters: [
          {
            name: 'search',
            in: 'query',
            description: 'Case-insensitive match against title or description',
            schema: { type: 'string', maxLength: 200 },
          },
          { name: 'location', in: 'query', schema: { type: 'string', maxLength: 200 } },
          {
            name: 'type',
            in: 'query',
            schema: { $ref: '#/components/schemas/JobType' },
          },
          {
            name: 'workMode',
            in: 'query',
            schema: { $ref: '#/components/schemas/WorkMode' },
          },
          {
            name: 'salaryMin',
            in: 'query',
            description: 'Only jobs whose advertised salaryMax reaches this floor',
            schema: { type: 'integer', minimum: 0 },
          },
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          },
          {
            name: 'sort',
            in: 'query',
            description: 'Prefix with `-` for descending. Allowlisted fields only.',
            schema: {
              type: 'string',
              enum: ['createdAt', '-createdAt', 'salaryMax', '-salaryMax', 'title', '-title'],
              default: '-createdAt',
            },
          },
        ],
        responses: {
          200: {
            description: 'A page of jobs',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { type: 'array', items: { $ref: '#/components/schemas/Job' } },
                    meta: { $ref: '#/components/schemas/PaginationMeta' },
                  },
                },
              },
            },
          },
          400: VALIDATION_FAILED,
        },
      },
      post: {
        tags: ['Jobs'],
        summary: 'Create a job',
        description: 'EMPLOYER role required.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/JobInput' },
              example: {
                title: 'Backend Engineer',
                description: 'Build and maintain our API layer.',
                location: 'Remote (EU)',
                type: 'FULL_TIME',
                workMode: 'REMOTE',
                salaryMin: 90000,
                salaryMax: 130000,
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Created',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/Job' } },
            },
          },
          400: VALIDATION_FAILED,
          401: UNAUTHORIZED,
          403: FORBIDDEN,
        },
      },
    },

    '/jobs/{id}': {
      get: {
        tags: ['Jobs'],
        summary: 'Fetch one job',
        description: 'Public. Returns the employer name only, never their email address.',
        security: [],
        parameters: [idPath],
        responses: {
          200: {
            description: 'The job',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Job' } } },
          },
          400: VALIDATION_FAILED,
          404: NOT_FOUND,
        },
      },
      put: {
        tags: ['Jobs'],
        summary: 'Update a job',
        description: 'EMPLOYER role required, and the caller must own the job.',
        parameters: [idPath],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                allOf: [
                  { $ref: '#/components/schemas/JobInput' },
                  { type: 'object', properties: { isActive: { type: 'boolean' } } },
                ],
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Updated',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Job' } } },
          },
          400: VALIDATION_FAILED,
          401: UNAUTHORIZED,
          403: FORBIDDEN,
          404: NOT_FOUND,
        },
      },
      delete: {
        tags: ['Jobs'],
        summary: 'Delete a job',
        description: 'Cascades to the job’s applications. EMPLOYER role required, owner only.',
        parameters: [idPath],
        responses: {
          204: { description: 'Deleted' },
          400: VALIDATION_FAILED,
          401: UNAUTHORIZED,
          403: FORBIDDEN,
          404: NOT_FOUND,
        },
      },
    },

    '/applications': {
      post: {
        tags: ['Applications'],
        summary: 'Apply to a job',
        description: 'APPLICANT role required. One application per applicant per job.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['jobId'],
                properties: {
                  jobId: { type: 'string', format: 'uuid' },
                  coverLetter: { type: 'string', maxLength: 5000 },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Application submitted',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/Application' } },
            },
          },
          400: VALIDATION_FAILED,
          401: UNAUTHORIZED,
          403: FORBIDDEN,
          404: errorResponse('Job missing or closed', {
            code: 'NOT_FOUND',
            message: 'Job not found or closed',
          }),
          409: errorResponse('Already applied to this job', {
            code: 'CONFLICT',
            message: 'That record already exists',
          }),
        },
      },
    },

    '/applications/my': {
      get: {
        tags: ['Applications'],
        summary: 'The caller’s own applications',
        responses: {
          200: {
            description: 'Applications, newest first',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { type: 'array', items: { $ref: '#/components/schemas/Application' } },
                  },
                },
              },
            },
          },
          401: UNAUTHORIZED,
        },
      },
    },

    '/applications/job/{id}': {
      get: {
        tags: ['Applications'],
        summary: 'Applications for one of your jobs',
        description: 'EMPLOYER role required, and the caller must own the job.',
        parameters: [idPath],
        responses: {
          200: {
            description: 'Applications, newest first, with applicant contact details',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { type: 'array', items: { $ref: '#/components/schemas/Application' } },
                  },
                },
              },
            },
          },
          400: VALIDATION_FAILED,
          401: UNAUTHORIZED,
          403: FORBIDDEN,
          404: NOT_FOUND,
        },
      },
    },

    '/applications/{id}/status': {
      patch: {
        tags: ['Applications'],
        summary: 'Accept or reject an application',
        description: 'EMPLOYER role required, and the caller must own the underlying job.',
        parameters: [idPath],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['status'],
                properties: { status: { type: 'string', enum: ['ACCEPTED', 'REJECTED'] } },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Updated',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/Application' } },
            },
          },
          400: VALIDATION_FAILED,
          401: UNAUTHORIZED,
          403: FORBIDDEN,
          404: NOT_FOUND,
        },
      },
    },
  },

  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },

    schemas: {
      JobType: {
        type: 'string',
        enum: ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP'],
      },
      WorkMode: {
        type: 'string',
        description: 'Where the work happens. Independent of employment type.',
        enum: ['ONSITE', 'HYBRID', 'REMOTE'],
      },

      User: {
        type: 'object',
        description: 'The password hash is never included in any response.',
        properties: {
          id: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email' },
          role: { type: 'string', enum: ['EMPLOYER', 'APPLICANT'] },
          name: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },

      JobInput: {
        type: 'object',
        required: ['title', 'description'],
        properties: {
          title: { type: 'string', minLength: 3, maxLength: 200 },
          description: { type: 'string', minLength: 10, maxLength: 20000 },
          location: { type: 'string', maxLength: 200 },
          type: { $ref: '#/components/schemas/JobType' },
          workMode: { $ref: '#/components/schemas/WorkMode' },
          salaryMin: { type: 'integer', minimum: 0 },
          salaryMax: {
            type: 'integer',
            minimum: 0,
            description: 'Must be greater than or equal to salaryMin.',
          },
          salaryCurrency: { type: 'string', minLength: 3, maxLength: 3, default: 'USD' },
        },
      },

      Job: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          title: { type: 'string' },
          description: { type: 'string' },
          location: { type: 'string', nullable: true },
          salaryMin: { type: 'integer', nullable: true },
          salaryMax: { type: 'integer', nullable: true },
          salaryCurrency: { type: 'string' },
          type: { allOf: [{ $ref: '#/components/schemas/JobType' }], nullable: true },
          workMode: { allOf: [{ $ref: '#/components/schemas/WorkMode' }], nullable: true },
          isActive: { type: 'boolean' },
          employerId: { type: 'string', format: 'uuid' },
          employer: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              name: { type: 'string', nullable: true },
            },
          },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },

      Application: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          coverLetter: { type: 'string', nullable: true },
          status: { type: 'string', enum: ['PENDING', 'ACCEPTED', 'REJECTED'] },
          applicantId: { type: 'string', format: 'uuid' },
          jobId: { type: 'string', format: 'uuid' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },

      PaginationMeta: {
        type: 'object',
        properties: {
          page: { type: 'integer' },
          limit: { type: 'integer' },
          total: { type: 'integer' },
          totalPages: { type: 'integer' },
          hasNext: { type: 'boolean' },
        },
      },

      Error: {
        type: 'object',
        description: 'Every failure in the API uses this shape.',
        properties: {
          error: {
            type: 'object',
            required: ['code', 'message'],
            properties: {
              code: {
                type: 'string',
                enum: [
                  'BAD_REQUEST',
                  'VALIDATION_FAILED',
                  'MALFORMED_JSON',
                  'UNAUTHORIZED',
                  'FORBIDDEN',
                  'NOT_FOUND',
                  'CONFLICT',
                  'PAYLOAD_TOO_LARGE',
                  'TOO_MANY_REQUESTS',
                  'INTERNAL_ERROR',
                ],
              },
              message: { type: 'string' },
              details: {
                type: 'array',
                description: 'Present on validation failures.',
                items: {
                  type: 'object',
                  properties: {
                    path: { type: 'string' },
                    message: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
  },

  // Applies to every operation unless overridden with `security: []`.
  security: [{ bearerAuth: [] }],
} as const;
