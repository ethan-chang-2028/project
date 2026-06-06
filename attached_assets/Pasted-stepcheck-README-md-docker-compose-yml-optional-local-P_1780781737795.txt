stepcheck/
├── README.md
├── docker-compose.yml              # optional: local Postgres + both services
├── .env.example                    # connection strings, API keys
├── stepcheck_schema.sql            # the Postgres schema (already written)
│
├── web/                            # Next.js app — frontend + API
│   ├── package.json
│   ├── next.config.js
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   ├── prisma/
│   │   ├── schema.prisma           # Prisma models (mirror of the SQL schema)
│   │   └── migrations/
│   ├── public/
│   └── src/
│       ├── app/                    # App Router (pages + API routes)
│       │   ├── layout.tsx
│       │   ├── page.tsx            # landing page
│       │   ├── (auth)/
│       │   │   ├── login/page.tsx
│       │   │   └── signup/page.tsx
│       │   ├── student/
│       │   │   ├── dashboard/page.tsx          # assigned homework
│       │   │   ├── homework/[id]/page.tsx      # the work workspace
│       │   │   └── inbox/page.tsx
│       │   ├── teacher/
│       │   │   ├── dashboard/page.tsx          # class dashboard
│       │   │   ├── classes/page.tsx            # classes + join codes
│       │   │   ├── homework/new/page.tsx       # authoring (templates, answer key)
│       │   │   ├── students/[id]/page.tsx      # per-student view + override
│       │   │   └── inbox/page.tsx
│       │   └── api/
│       │       ├── enroll/route.ts             # join a class by code
│       │       ├── submissions/route.ts        # submit (final) -> triggers grading
│       │       ├── grade/route.ts              # orchestrates verifier + LLM
│       │       ├── feedback/route.ts
│       │       └── messages/route.ts           # inbox
│       ├── components/
│       │   ├── workspace/
│       │   │   ├── IceTableGrid.tsx
│       │   │   ├── EquationEditor.tsx
│       │   │   └── CalculationPad.tsx
│       │   ├── teacher/
│       │   │   ├── HomeworkBuilder.tsx
│       │   │   └── GradeOverride.tsx
│       │   └── ui/                             # shared buttons, inputs, etc.
│       ├── lib/
│       │   ├── prisma.ts                       # Prisma client
│       │   ├── supabase.ts                     # Supabase client + auth helpers
│       │   ├── ai/
│       │   │   ├── parser.ts                   # LLM: parse student work into steps
│       │   │   └── feedback.ts                 # LLM: write mistake feedback
│       │   └── grading/
│       │       └── verifierClient.ts           # calls the Python verifier service
│       └── types/
│
└── verifier/                       # Python service — the deterministic verifier
    ├── requirements.txt
    ├── .env.example
    └── app/
        ├── main.py                 # FastAPI entry point
        ├── models.py               # request/response schemas (pydantic)
        ├── diff.py                 # align student steps vs the correct chain
        └── solvers/                # thin per-type logic wrapping SymPy
            ├── ice_table.py
            ├── quadratic.py
            └── kinematics.py