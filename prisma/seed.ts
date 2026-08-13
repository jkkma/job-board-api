import { PrismaClient, type Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/**
 * Fixed UUIDs and `upsert` throughout, so running the seed twice produces the
 * same database rather than a second copy of everything. That also means demo
 * links stay valid across re-seeds.
 */
const DEMO_PASSWORD = 'password123';

const employers = [
  { id: '11111111-1111-4111-8111-111111111111', email: 'hire@acme.com', name: 'Acme Corp' },
  { id: '22222222-2222-4222-8222-222222222222', email: 'jobs@globex.com', name: 'Globex' },
  { id: '33333333-3333-4333-8333-333333333333', email: 'talent@initech.com', name: 'Initech' },
];

const applicants = [
  { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', email: 'ada@example.com', name: 'Ada Lovelace' },
  { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', email: 'grace@example.com', name: 'Grace Hopper' },
  { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', email: 'alan@example.com', name: 'Alan Turing' },
];

const jobs: Prisma.JobUncheckedCreateInput[] = [
  {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
    title: 'Senior Backend Engineer',
    description:
      'Own and evolve our core API platform. You will design services, tune PostgreSQL queries, and mentor engineers across the team.',
    location: 'Remote (EU)',
    salaryMin: 90_000,
    salaryMax: 130_000,
    type: 'FULL_TIME',
    workMode: 'REMOTE',
    employerId: employers[0].id,
  },
  {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
    title: 'Platform Engineer',
    description:
      'Build and maintain the deployment pipeline, container images, and observability stack that the product teams depend on.',
    location: 'Berlin, DE',
    salaryMin: 75_000,
    salaryMax: 100_000,
    type: 'FULL_TIME',
    workMode: 'HYBRID',
    employerId: employers[0].id,
  },
  {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3',
    title: 'Frontend Engineer (React)',
    description:
      'Craft the candidate-facing experience. Strong TypeScript, an eye for accessibility, and opinions about component APIs.',
    location: 'London, UK',
    salaryMin: 65_000,
    salaryMax: 85_000,
    type: 'FULL_TIME',
    workMode: 'HYBRID',
    employerId: employers[1].id,
  },
  {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4',
    title: 'Data Engineer',
    description:
      'Model the analytics warehouse and keep the ingestion jobs honest. SQL fluency required, dbt experience welcome.',
    location: 'Remote (Global)',
    salaryMin: 80_000,
    salaryMax: 115_000,
    type: 'CONTRACT',
    workMode: 'REMOTE',
    employerId: employers[1].id,
  },
  {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb5',
    title: 'Backend Engineering Intern',
    description:
      'A twelve-week paid internship working alongside the API team. We will teach you the rest; bring curiosity.',
    location: 'Austin, TX',
    salaryMin: 30_000,
    salaryMax: 40_000,
    type: 'INTERNSHIP',
    workMode: 'ONSITE',
    employerId: employers[2].id,
  },
  {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb6',
    title: 'Site Reliability Engineer',
    description:
      'Keep the lights on and the pager quiet. You will own SLOs, incident response, and capacity planning.',
    location: 'Austin, TX',
    salaryMin: 110_000,
    salaryMax: 150_000,
    type: 'FULL_TIME',
    workMode: 'ONSITE',
    employerId: employers[2].id,
  },
  {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb7',
    title: 'Part-time QA Engineer',
    description:
      'Own the end-to-end test suite and release checklist. Twenty hours a week, flexible schedule.',
    location: 'Remote (US)',
    salaryMin: 40_000,
    salaryMax: 55_000,
    type: 'PART_TIME',
    workMode: 'REMOTE',
    employerId: employers[0].id,
  },
  {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb8',
    title: 'Staff Engineer, Search',
    description:
      'Lead the search relevance effort end to end: ranking, indexing strategy, and the query pipeline behind them.',
    location: 'Remote (EU)',
    salaryMin: 130_000,
    salaryMax: 175_000,
    type: 'FULL_TIME',
    workMode: 'REMOTE',
    isActive: false, // one closed listing, so the isActive filter has something to exclude
    employerId: employers[1].id,
  },
];

const applications = [
  {
    applicant: 0,
    job: 0,
    status: 'PENDING',
    coverLetter: 'I have spent six years on API platforms.',
  },
  {
    applicant: 0,
    job: 3,
    status: 'ACCEPTED',
    coverLetter: 'Warehouse modelling is my favourite problem.',
  },
  { applicant: 1, job: 0, status: 'REJECTED', coverLetter: 'Keen to work on the core platform.' },
  {
    applicant: 1,
    job: 5,
    status: 'PENDING',
    coverLetter: 'I have carried the pager for four years.',
  },
  {
    applicant: 2,
    job: 4,
    status: 'PENDING',
    coverLetter: 'Final-year student, strong on fundamentals.',
  },
] as const;

async function main(): Promise<void> {
  const password = await bcrypt.hash(DEMO_PASSWORD, 10);

  for (const employer of employers) {
    await prisma.user.upsert({
      where: { id: employer.id },
      update: { email: employer.email, name: employer.name },
      create: { ...employer, password, role: 'EMPLOYER' },
    });
  }

  for (const applicant of applicants) {
    await prisma.user.upsert({
      where: { id: applicant.id },
      update: { email: applicant.email, name: applicant.name },
      create: { ...applicant, password, role: 'APPLICANT' },
    });
  }

  for (const job of jobs) {
    const { id, ...rest } = job;
    await prisma.job.upsert({ where: { id }, update: rest, create: job });
  }

  for (const application of applications) {
    const applicantId = applicants[application.applicant].id;
    const jobId = jobs[application.job].id!;
    await prisma.application.upsert({
      where: { applicantId_jobId: { applicantId, jobId } },
      update: { status: application.status },
      create: {
        applicantId,
        jobId,
        status: application.status,
        coverLetter: application.coverLetter,
      },
    });
  }

  console.log(`Seeded ${employers.length} employers, ${applicants.length} applicants,`);
  console.log(`       ${jobs.length} jobs, ${applications.length} applications.\n`);
  console.log('Demo logins (all use the same password):');
  console.log(`  EMPLOYER   ${employers[0].email}`);
  console.log(`  APPLICANT  ${applicants[0].email}`);
  console.log(`  password   ${DEMO_PASSWORD}\n`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
