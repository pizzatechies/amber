// Content for the demo seed (npm run db:seed:demo). All of it is fictional.

export type DemoLecture =
  | { kind: "video"; title: string; preview?: boolean; notes?: string }
  | { kind: "article"; title: string; body: string }
  | {
      kind: "quiz";
      title: string;
      questions: Array<{ prompt: string; options: string[]; correct: number[]; explanation?: string }>;
    }
  | { kind: "document"; title: string }
  | { kind: "empty-video"; title: string };

export type DemoCourse = {
  title: string;
  subtitle: string;
  category: string;
  level: "ALL_LEVELS" | "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  /** In major currency units; 0 is free. */
  price: number;
  /** Instructor's email. */
  instructor: string;
  description: string;
  outcomes: string[];
  requirements: string[];
  audience: string[];
  sections: Array<{ title: string; lectures: DemoLecture[] }>;
  status?: "PUBLISHED" | "IN_REVIEW" | "DRAFT";
  publishedDaysAgo?: number;
};

const v = (title: string, notes?: string): DemoLecture => ({ kind: "video", title, notes });

export const demoPeople = {
  admin: { email: "admin@amber.test", name: "Morgan Reyes" },
  instructors: [
    {
      email: "ada@amber.test",
      name: "Ada Mensah",
      headline: "Leadership coach and former engineering director",
      bio: "I led engineering teams for twelve years, from my first awkward one-to-one to running a department of eighty people. Now I coach new managers through the transition I found hardest. My courses are short, practical and built around conversations you can have this week.",
      websiteUrl: "https://example.com/ada",
    },
    {
      email: "ravi@amber.test",
      name: "Ravi Patel",
      headline: "Strategy consultant and operations leader",
      bio: "I help leadership teams decide what matters, say no to the rest, and turn plans into weekly habits. Before consulting I ran operations for a retail business through two turnarounds.",
      websiteUrl: "",
    },
    {
      email: "lena@amber.test",
      name: "Lena Fischer",
      headline: "Organisational psychologist",
      bio: "I study what makes teams work and teach managers to use it: trust, psychological safety, motivation and coaching. Evidence first, jargon last.",
      websiteUrl: "https://example.com/lena",
    },
    {
      email: "samuel@amber.test",
      name: "Samuel Okoye",
      headline: "Founder and communication coach",
      bio: "I've started three companies and coached hundreds of first-time founders and executives. I teach leaders to communicate with clarity, especially when the news is hard.",
      websiteUrl: "",
    },
  ],
  students: [
    { email: "maya@amber.test", name: "Maya Chen" },
    { email: "tom@amber.test", name: "Tom Rivera" },
    { email: "zainab@amber.test", name: "Zainab Ali" },
    { email: "noah@amber.test", name: "Noah Kim" },
    { email: "priya@amber.test", name: "Priya Nair" },
    { email: "lucas@amber.test", name: "Lucas Martin" },
    { email: "elena@amber.test", name: "Elena Petrova" },
    { email: "james@amber.test", name: "James Banda" },
    { email: "sofia@amber.test", name: "Sofia Alvarez" },
    { email: "kenji@amber.test", name: "Kenji Watanabe" },
  ],
};

export const reviewComments: Record<3 | 4 | 5, string[]> = {
  5: [
    "Clear, well paced and genuinely useful. I used the frameworks in my one-to-ones the very next week.",
    "Exactly the right amount of detail. The examples made everything click.",
    "One of the best-structured courses I've taken. Every lecture has a point.",
    "The instructor explains the 'why' as well as the 'how'. Highly recommended.",
  ],
  4: [
    "Very good overall. I'd have liked a few more role-play examples, but the explanations are excellent.",
    "Solid course with a practical focus. A couple of sections could go deeper.",
    "Great introduction. It gave me the confidence to keep going on my own.",
  ],
  3: [
    "Decent content, though some lectures felt rushed. Still worth it for beginners.",
    "Good overview, but I was hoping for more material for senior leaders towards the end.",
  ],
};

export const demoCourses: DemoCourse[] = [
  {
    title: "Leading Teams: Your First 90 Days as a Manager",
    subtitle: "Move from doing the work to leading the people who do it, with a plan for your first three months.",
    category: "Leadership",
    level: "BEGINNER",
    price: 49.99,
    instructor: "ada@amber.test",
    publishedDaysAgo: 80,
    description:
      "Becoming a manager is a change of job, not a promotion in the same one. The skills that got you here are not the ones that will make you good at this.\n\nThis course gives you a practical plan for your first 90 days:\n\n1. **Listen** — understand your team, your manager's expectations and how work really gets done\n2. **Set up the basics** — one-to-ones, team rhythms and clear priorities\n3. **Lead** — give feedback, delegate and make your first decisions with confidence\n\nEvery section ends with a short exercise you can use with your own team the same week.",
    outcomes: [
      "Build a 30-60-90 day plan for a new team",
      "Run one-to-ones people look forward to",
      "Set clear expectations and agree team priorities",
      "Handle the shift from peer to manager with confidence",
    ],
    requirements: ["You manage people now, or will soon", "No previous management training needed"],
    audience: ["First-time managers and team leads", "Experienced specialists about to lead their first team"],
    sections: [
      {
        title: "From doing to leading",
        lectures: [
          v("What changes when you become a manager", "Keep a note of the three tasks you find hardest to let go of. We come back to them in section three."),
          v("Your first conversation with your manager"),
          {
            kind: "article",
            title: "Cheat sheet: the first-week listening tour",
            body: "Meet everyone on the team one-to-one in your first week and ask the same five questions:\n\n| Question | What you learn |\n| --- | --- |\n| What's going well that we must not break? | What to protect |\n| What gets in your way? | Where to start helping |\n| What would you change if you were me? | Hidden ideas |\n| How do you like to receive feedback? | How to work with them |\n| What should I ask that I haven't? | Blind spots |\n\n> Listen more than you speak. Your job this week is to understand, not to fix.",
          },
          {
            kind: "quiz",
            title: "Check your understanding: the new manager role",
            questions: [
              {
                prompt: "In your first two weeks as a new manager, what should take most of your time?",
                options: ["Fixing the biggest problem you can see", "Listening and understanding the team", "Redesigning the team's processes", "Doing the hardest work yourself"],
                correct: [1],
                explanation: "Early changes made without context often backfire. Listening first earns trust and shows you what to change.",
              },
              {
                prompt: "Which of these belong in a good one-to-one? Select all that apply.",
                options: ["The team member's own agenda", "Feedback in both directions", "A status update you could read in a dashboard"],
                correct: [0, 1],
                explanation: "One-to-ones are the report's time. Status updates belong elsewhere.",
              },
            ],
          },
        ],
      },
      {
        title: "Setting up the basics",
        lectures: [v("One-to-ones that people value"), v("Team rhythms: stand-ups, reviews and retros"), v("Agreeing priorities with your team")],
      },
      {
        title: "Leading with confidence",
        lectures: [v("Making your first difficult decision"), v("Managing former peers"), { kind: "document", title: "Your 90-day plan workbook (PDF)" }],
      },
    ],
  },
  {
    title: "Giving Feedback That Lands",
    subtitle: "A simple, repeatable way to give praise and criticism that people can act on.",
    category: "Communication",
    level: "ALL_LEVELS",
    price: 0,
    instructor: "ada@amber.test",
    publishedDaysAgo: 60,
    description:
      "Most feedback fails for one of two reasons: it's too vague to act on, or it's delivered in a way that makes people defensive.\n\nIn this short free course you'll learn a simple structure for feedback that is specific, kind and useful, and practise it on real situations.",
    outcomes: [
      "Describe behaviour and impact instead of judging personality",
      "Give positive feedback that reinforces what works",
      "Deliver critical feedback without damaging the relationship",
    ],
    requirements: ["None"],
    audience: ["Managers and team leads", "Anyone who wants to give better feedback to colleagues"],
    sections: [
      {
        title: "The structure",
        lectures: [v("Why most feedback misses"), v("Situation, behaviour, impact")],
      },
      {
        title: "Putting it into practice",
        lectures: [
          v("Feedback conversations, step by step"),
          {
            kind: "article",
            title: "Phrases that help, phrases that hurt",
            body: "Small wording changes make a big difference:\n\n- Instead of **\"You're always late\"**, say *\"You joined the last three client calls after they started\"*\n- Instead of **\"Great job\"**, say *\"The summary you sent made the decision easy — thank you\"*\n- Instead of **\"You need to be more proactive\"**, say *\"I'd like you to flag risks in our Monday meeting\"*\n\nSpecific feedback is easier to hear, because it's about something that happened, not about who someone is.",
          },
          {
            kind: "quiz",
            title: "Quick quiz",
            questions: [
              {
                prompt: "What should good feedback focus on?",
                options: ["The person's personality", "A specific, observable behaviour and its impact", "How you felt that day"],
                correct: [1],
                explanation: "Behaviour can change; personality labels just make people defensive.",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    title: "Strategic Thinking for Leaders",
    subtitle: "Decide what matters, say no to the rest, and turn strategy into weekly work.",
    category: "Leadership",
    level: "INTERMEDIATE",
    price: 59.99,
    instructor: "ravi@amber.test",
    publishedDaysAgo: 70,
    description:
      "Strategy isn't a document, it's a set of choices. This course teaches a practical way to make those choices as a team leader or head of department, and to keep them alive after the off-site.\n\nWe work through one realistic case from start to finish: diagnosing the situation, choosing where to focus, and translating it into goals your team can act on.",
    outcomes: [
      "Diagnose the real challenge behind a messy situation",
      "Choose a focus and explain the trade-offs",
      "Turn a strategy into goals and weekly priorities",
      "Spot when a plan needs to change",
    ],
    requirements: ["Some experience leading a team or project"],
    audience: ["Team leads stepping into a broader role", "Heads of department and senior managers"],
    sections: [
      {
        title: "Thinking strategically",
        lectures: [v("Strategy is a set of choices"), v("Diagnosing the real problem")],
      },
      {
        title: "Making the choices",
        lectures: [
          v("Where to focus, and what to stop"),
          v("Weighing options without overthinking"),
          {
            kind: "quiz",
            title: "Practice: spotting a real strategy",
            questions: [
              {
                prompt: "Which of these is a strategic choice rather than an aspiration?",
                options: ["Be the best team in the company", "Focus on enterprise customers and stop custom work for small ones", "Grow revenue every year"],
                correct: [1],
                explanation: "A real choice says what you will and won't do.",
              },
              {
                prompt: "A good strategy should make it easier to...",
                options: ["Say no to good ideas that don't fit", "Avoid all risk", "Keep every option open"],
                correct: [0],
              },
            ],
          },
        ],
      },
      { title: "From plan to action", lectures: [v("Goals your team can act on"), v("Reviewing and adapting the plan")] },
    ],
  },
  {
    title: "Running Effective Meetings",
    subtitle: "Shorter meetings, clearer decisions and fewer follow-up emails.",
    category: "Management",
    level: "BEGINNER",
    price: 39.99,
    instructor: "ravi@amber.test",
    publishedDaysAgo: 45,
    description:
      "Most managers spend half their week in meetings, and most of those meetings could be shorter or shouldn't happen at all.\n\nThis course shows you how to decide when a meeting is needed, design an agenda that drives a decision, facilitate so everyone contributes, and follow up so things actually happen.",
    outcomes: ["Decide when a meeting is worth having", "Write agendas built around decisions", "Facilitate so quieter voices are heard", "Close every meeting with clear owners and next steps"],
    requirements: ["You run or attend regular meetings"],
    audience: ["Managers and team leads", "Project and programme managers"],
    sections: [
      { title: "Before the meeting", lectures: [v("Does this need a meeting?"), v("Agendas that drive decisions")] },
      {
        title: "In the room",
        lectures: [
          v("Facilitation basics"),
          {
            kind: "article",
            title: "Template: the one-page meeting plan",
            body: "Before every meeting, write down:\n\n1. **Purpose** — the decision or outcome you need\n2. **People** — only those who can contribute to it\n3. **Pre-work** — what everyone should read first\n4. **Agenda** — each item phrased as a question\n5. **Close** — who does what, by when\n\nIf you can't fill in the purpose, cancel the meeting.",
          },
        ],
      },
    ],
  },
  {
    title: "Emotional Intelligence at Work",
    subtitle: "Understand your reactions, read the room and handle tense moments calmly.",
    category: "Personal Development",
    level: "ALL_LEVELS",
    price: 44.99,
    instructor: "lena@amber.test",
    publishedDaysAgo: 55,
    description:
      "Emotional intelligence is not about being nice. It's the ability to notice what you and others are feeling, and to choose a useful response instead of an automatic one.\n\nThis course covers the four skills behind it — **self-awareness**, **self-management**, **social awareness** and **relationship management** — with practical exercises for each.",
    outcomes: ["Recognise your own triggers before they take over", "Stay calm and constructive under pressure", "Read how others are feeling and respond well", "Defuse tension in difficult conversations"],
    requirements: ["None"],
    audience: ["Anyone who works with people", "Leaders who want to build stronger relationships"],
    sections: [
      { title: "Knowing yourself", lectures: [v("What emotional intelligence really is"), v("Spotting your triggers")] },
      { title: "Managing yourself", lectures: [v("The pause between stimulus and response"), v("Working under pressure")] },
      {
        title: "Working with others",
        lectures: [
          v("Reading the room"),
          {
            kind: "quiz",
            title: "Check: responding under pressure",
            questions: [
              {
                prompt: "A colleague criticises your work in front of the team. What is the most emotionally intelligent first step?",
                options: ["Defend your work immediately", "Pause, acknowledge the point and suggest discussing it after the meeting", "Ignore it completely"],
                correct: [1],
                explanation: "Pausing gives you a choice of response and keeps the conversation productive.",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    title: "Coaching Conversations for Managers",
    subtitle: "Help people solve their own problems with better questions.",
    category: "Management",
    level: "INTERMEDIATE",
    price: 34.99,
    instructor: "lena@amber.test",
    publishedDaysAgo: 20,
    description:
      "When someone brings you a problem, the fastest answer is usually to solve it for them. The better answer, most of the time, is to help them solve it themselves.\n\nYou'll learn a simple coaching structure, the questions that make it work, and how to fit coaching into the time you already spend with your team.",
    outcomes: ["Use a simple structure for coaching conversations", "Ask open questions that move people forward", "Know when to coach and when to just answer"],
    requirements: ["You lead at least one person"],
    audience: ["Managers who want to grow their team's capability"],
    sections: [
      { title: "The coaching mindset", lectures: [v("Coaching versus telling"), v("A simple coaching structure")] },
      { title: "In practice", lectures: [v("Questions that open things up"), v("Coaching in ten minutes")] },
    ],
  },
  {
    title: "Leading Through Change",
    subtitle: "Bring people with you through reorganisations, new strategies and uncertain times.",
    category: "Leadership",
    level: "ADVANCED",
    price: 29.99,
    instructor: "samuel@amber.test",
    publishedDaysAgo: 75,
    description:
      "Change fails far more often because of people than because of plans. This course shows leaders how to explain change, handle resistance and keep a team performing while things are uncertain.\n\nYou'll build a change plan for a real situation you're facing and practise the conversations it needs.",
    outcomes: ["Explain the why behind a change clearly", "Understand and work with resistance", "Keep morale and performance up during uncertainty"],
    requirements: ["Experience leading a team"],
    audience: ["Managers and senior leaders", "Anyone responsible for a change programme"],
    sections: [
      { title: "Why change is hard", lectures: [v("How people experience change"), v("Resistance is information")] },
      {
        title: "Leading the change",
        lectures: [
          v("Telling the story of the change"),
          {
            kind: "article",
            title: "Template: the one-page change plan",
            body: "Answer these questions in a sentence each:\n\n1. **What** is changing, and what isn't?\n2. **Why** now?\n3. **Who** is affected, and how?\n4. **What** will people need to learn or stop doing?\n5. **How** will you hear concerns?\n6. **What** does success look like in three months?\n\nShare it with your team before the big announcement, not after.",
          },
          v("Keeping the team going"),
        ],
      },
    ],
  },
  {
    title: "Delegation Without Losing Control",
    subtitle: "Hand off work with confidence and free up time for what only you can do.",
    category: "Management",
    level: "BEGINNER",
    price: 0,
    instructor: "samuel@amber.test",
    publishedDaysAgo: 40,
    description:
      "If you're working late while your team waits for decisions, you're probably not delegating enough. This free course shows you what to delegate, how to hand it over and how to stay informed without micromanaging.",
    outcomes: ["Decide what to delegate and to whom", "Hand over work with clear outcomes and authority", "Check in without micromanaging"],
    requirements: ["None"],
    audience: ["Busy managers and team leads", "Founders growing their first team"],
    sections: [
      { title: "What to delegate", lectures: [v("Why managers hold on to work"), v("Choosing what to hand off")] },
      { title: "How to delegate", lectures: [v("The handover conversation"), v("Checking in, not checking up")] },
    ],
  },
  {
    title: "Executive Presence and Public Speaking",
    subtitle: "Speak with clarity and confidence in meetings, presentations and all-hands.",
    category: "Communication",
    level: "ALL_LEVELS",
    price: 24.99,
    instructor: "samuel@amber.test",
    publishedDaysAgo: 30,
    description:
      "Presence isn't something you're born with. It comes from preparation, structure and a few deliberate habits. Learn to structure any message, manage nerves and land your point with senior audiences.",
    outcomes: ["Structure any message in minutes", "Manage nerves before and during a talk", "Communicate clearly with senior stakeholders"],
    requirements: ["A phone to record yourself practising"],
    audience: ["Leaders who present to senior audiences", "Managers preparing for bigger roles"],
    sections: [
      { title: "Preparation", lectures: [v("One message, three points"), v("Openings and endings")] },
      { title: "Delivery", lectures: [v("Working with nerves"), v("Voice, pace and pauses")] },
    ],
  },
  {
    title: "Building High-Trust Teams",
    subtitle: "Create the psychological safety that lets teams speak up, take risks and learn.",
    category: "Leadership",
    level: "ALL_LEVELS",
    price: 19.99,
    instructor: "lena@amber.test",
    publishedDaysAgo: 15,
    description:
      "Teams that trust each other share bad news early, disagree openly and learn from mistakes. This course explains what psychological safety is, how to measure it and the everyday leadership habits that build it.",
    outcomes: ["Explain psychological safety and why it matters", "Spot the signs of low trust", "Build habits that make it safe to speak up"],
    requirements: ["None"],
    audience: ["Team leaders at any level"],
    sections: [
      { title: "Understanding trust", lectures: [v("What psychological safety is (and isn't)"), v("Signs of a low-trust team")] },
      { title: "Building it", lectures: [v("Everyday habits that build trust")] },
    ],
  },
  {
    title: "Negotiation Skills for Leaders",
    subtitle: "Reach better agreements with your team, your peers and your own manager.",
    category: "Business",
    level: "INTERMEDIATE",
    price: 27.99,
    instructor: "samuel@amber.test",
    status: "IN_REVIEW",
    description:
      "Leaders negotiate all day: over budgets, deadlines, priorities and people. Learn a practical approach to preparing for and conducting negotiations that keep relationships intact.",
    outcomes: ["Prepare for any negotiation in twenty minutes", "Find options that work for both sides", "Handle pressure tactics calmly"],
    requirements: ["None"],
    audience: ["Managers and senior leaders"],
    sections: [
      { title: "Preparation", lectures: [v("Interests, not positions"), v("Knowing your alternatives")] },
      { title: "At the table", lectures: [v("Making the first offer"), v("Handling pressure")] },
    ],
  },
  {
    title: "Leading Remote and Hybrid Teams",
    subtitle: "Keep a distributed team connected, aligned and productive.",
    category: "Leadership",
    level: "INTERMEDIATE",
    price: 54.99,
    instructor: "ada@amber.test",
    status: "DRAFT",
    description: "Work in progress.",
    outcomes: ["Design team rhythms for remote work"],
    requirements: [],
    audience: [],
    sections: [
      {
        title: "Working apart",
        lectures: [v("What changes when the team is remote"), { kind: "empty-video", title: "Async communication (recording soon)" }],
      },
    ],
  },
];
