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
      headline: "Software engineer and teacher",
      bio: "I've spent twelve years building web products and the last five teaching people to do the same. My courses are short, practical and built around projects you finish.",
      websiteUrl: "https://example.com/ada",
    },
    {
      email: "ravi@amber.test",
      name: "Ravi Patel",
      headline: "Data analyst, formerly in retail analytics",
      bio: "I help people who are comfortable with spreadsheets take the next step into SQL and Python, without the jargon.",
      websiteUrl: "",
    },
    {
      email: "lena@amber.test",
      name: "Lena Fischer",
      headline: "Product designer and photographer",
      bio: "Designer by trade, photographer by habit. I teach the fundamentals that make every later design decision easier.",
      websiteUrl: "https://example.com/lena",
    },
    {
      email: "samuel@amber.test",
      name: "Samuel Okoye",
      headline: "Founder and communication coach",
      bio: "I've started three small companies and coached hundreds of first-time founders and speakers. I teach what I wish I'd known at the start.",
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
    "Clear, well paced and genuinely useful. I finished it in a weekend and used what I learned on Monday.",
    "Exactly the right amount of detail. The examples made everything click.",
    "One of the best-structured courses I've taken. Every lecture has a point.",
    "The instructor explains the 'why' as well as the 'how'. Highly recommended.",
  ],
  4: [
    "Very good overall. I'd have liked a few more practice exercises, but the explanations are excellent.",
    "Solid course with a practical focus. A couple of sections could go deeper.",
    "Great introduction. It gave me the confidence to keep going on my own.",
  ],
  3: [
    "Decent content, though some lectures felt rushed. Still worth it for beginners.",
    "Good overview, but I was hoping for more advanced material towards the end.",
  ],
};

export const demoCourses: DemoCourse[] = [
  {
    title: "Web Development Foundations: HTML, CSS and JavaScript",
    subtitle: "Build and publish your first three websites from a blank file, with no frameworks in the way.",
    category: "Development",
    level: "BEGINNER",
    price: 49.99,
    instructor: "ada@amber.test",
    publishedDaysAgo: 80,
    description:
      "This course takes you from an empty folder to a published, responsive website.\n\nYou won't install a framework or copy code you don't understand. Instead you'll learn the three languages every web page is made of, in the order that makes them easiest to learn:\n\n1. **HTML** for structure and meaning\n2. **CSS** for layout and style\n3. **JavaScript** for behaviour\n\nEach section ends with a small project. By the end you'll have three finished pages and the vocabulary to keep learning on your own.",
    outcomes: [
      "Write clean, semantic HTML that works for every visitor",
      "Lay out pages with flexbox and grid",
      "Make a page respond to clicks and form input with JavaScript",
      "Publish a site so anyone can visit it",
    ],
    requirements: ["A computer with a modern browser", "No programming experience needed"],
    audience: ["Complete beginners", "Designers who want to build what they draw"],
    sections: [
      {
        title: "Structure with HTML",
        lectures: [
          v("What a web page really is", "Open the browser's developer tools while you watch — you'll use them in every lecture."),
          v("Headings, paragraphs and links"),
          {
            kind: "article",
            title: "Cheat sheet: the 15 tags you'll use most",
            body: "Keep this page open while you work.\n\n| Tag | Use it for |\n| --- | --- |\n| `<h1>`–`<h3>` | Headings, in order |\n| `<p>` | Paragraphs |\n| `<a>` | Links |\n| `<img>` | Images (always add `alt`) |\n| `<ul>` / `<ol>` | Lists |\n| `<button>` | Anything clickable that isn't a link |\n\n> If you're unsure which tag to use, ask what the content *is*, not how it should look.",
          },
          {
            kind: "quiz",
            title: "Check your understanding: HTML",
            questions: [
              {
                prompt: "Which element should you use for the main heading of a page?",
                options: ["<title>", "<h1>", "<header>", "<strong>"],
                correct: [1],
                explanation: "<h1> is the top-level heading in the page content. <title> sets the browser tab text.",
              },
              {
                prompt: "Which of these make an image accessible? Select all that apply.",
                options: [
                  "A descriptive alt attribute",
                  "An empty alt attribute for purely decorative images",
                  "Putting the description in the file name",
                ],
                correct: [0, 1],
                explanation: "Screen readers read alt text; an empty alt tells them to skip decorative images.",
              },
            ],
          },
        ],
      },
      {
        title: "Style with CSS",
        lectures: [v("Selectors and the cascade"), v("Layout with flexbox"), v("Responsive pages with grid")],
      },
      {
        title: "Behaviour with JavaScript",
        lectures: [v("Variables, functions and events"), v("Project: an interactive to-do list"), { kind: "document", title: "Course workbook (PDF)" }],
      },
    ],
  },
  {
    title: "Version Control with Git in One Afternoon",
    subtitle: "Commit, branch, merge and recover from mistakes — the everyday Git you actually need.",
    category: "Development",
    level: "BEGINNER",
    price: 0,
    instructor: "ada@amber.test",
    publishedDaysAgo: 60,
    description:
      "Git has a reputation for being hard. Most of that comes from learning commands before the ideas.\n\nIn this short free course you'll build a mental model first, then practise the handful of commands that cover almost everything you do day to day.",
    outcomes: [
      "Explain what a commit, a branch and a remote are",
      "Save, review and undo your work with confidence",
      "Work on a feature branch and merge it back",
    ],
    requirements: ["Basic comfort with a terminal"],
    audience: ["New developers", "Anyone who has ever been afraid to run a Git command"],
    sections: [
      {
        title: "The model",
        lectures: [v("Snapshots, not differences"), v("Your first repository")],
      },
      {
        title: "Everyday work",
        lectures: [
          v("Branching and merging"),
          {
            kind: "article",
            title: "How to undo almost anything",
            body: "Three commands cover most mistakes:\n\n- `git restore <file>` — throw away changes you haven't committed\n- `git commit --amend` — fix the commit you just made\n- `git revert <commit>` — undo an older commit safely\n\nNone of these rewrite history that other people already have, which is why they're the safe defaults.",
          },
          {
            kind: "quiz",
            title: "Quick quiz",
            questions: [
              {
                prompt: "What does a Git commit store?",
                options: ["Only the lines that changed", "A snapshot of the whole project", "A copy of the remote"],
                correct: [1],
                explanation: "Each commit is a snapshot. Git shows you differences by comparing snapshots.",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    title: "Python for Data Analysis",
    subtitle: "Load, clean and explore real datasets, then explain what you found.",
    category: "Data Science",
    level: "BEGINNER",
    price: 59.99,
    instructor: "ravi@amber.test",
    publishedDaysAgo: 70,
    description:
      "If you can use a spreadsheet, you can learn to analyse data with Python.\n\nWe work through one messy, realistic sales dataset from start to finish: loading it, cleaning it, answering business questions and presenting the results in charts a manager can read.",
    outcomes: [
      "Load data from CSV and Excel files",
      "Clean missing and inconsistent values",
      "Group, summarise and join tables",
      "Create clear charts that answer a question",
    ],
    requirements: ["Comfort with spreadsheets", "No coding experience needed"],
    audience: ["Analysts moving beyond spreadsheets", "Students preparing for data roles"],
    sections: [
      {
        title: "Getting data in",
        lectures: [v("Notebooks and your first table"), v("Reading files without surprises")],
      },
      {
        title: "Cleaning and shaping",
        lectures: [
          v("Missing values and types"),
          v("Grouping and aggregating"),
          {
            kind: "quiz",
            title: "Practice: choosing the right operation",
            questions: [
              {
                prompt: "You want total sales per region. Which operation do you need?",
                options: ["Filter", "Group and aggregate", "Sort", "Join"],
                correct: [1],
              },
              {
                prompt: "A column of prices was read as text. What should you do first?",
                options: ["Delete the column", "Convert it to a numeric type", "Sort it alphabetically"],
                correct: [1],
                explanation: "Numeric operations only work once the column has a numeric type.",
              },
            ],
          },
        ],
      },
      { title: "Telling the story", lectures: [v("Charts that answer a question"), v("Project: a one-page sales report")] },
    ],
  },
  {
    title: "Practical SQL for Analysts",
    subtitle: "Answer real business questions with joins, aggregates and window functions.",
    category: "Data Science",
    level: "INTERMEDIATE",
    price: 39.99,
    instructor: "ravi@amber.test",
    publishedDaysAgo: 45,
    description:
      "A hands-on SQL course built around questions an analyst is actually asked: *Which customers came back? What changed month over month? Where do orders get stuck?*\n\nEvery lecture starts with the question and ends with a query you can adapt.",
    outcomes: [
      "Join tables correctly and spot duplicated rows",
      "Summarise data with GROUP BY and HAVING",
      "Use window functions for rankings and running totals",
    ],
    requirements: ["You can write a basic SELECT statement"],
    audience: ["Analysts", "Product managers who want to self-serve data"],
    sections: [
      { title: "Joins without fear", lectures: [v("Inner, left and the rows you lose"), v("Finding accidental duplicates")] },
      {
        title: "Beyond GROUP BY",
        lectures: [
          v("Window functions, explained visually"),
          {
            kind: "article",
            title: "Pattern library: five queries worth memorising",
            body: "1. **Latest row per group** — `ROW_NUMBER() OVER (PARTITION BY ... ORDER BY ... DESC)`\n2. **Running total** — `SUM(x) OVER (ORDER BY date)`\n3. **Month-over-month change** — `LAG(x) OVER (ORDER BY month)`\n4. **Share of total** — `x / SUM(x) OVER ()`\n5. **Gaps in a sequence** — compare each row with `LAG(id)`",
          },
        ],
      },
    ],
  },
  {
    title: "Design Fundamentals: Layout, Type and Colour",
    subtitle: "The principles behind interfaces and pages that feel right, with exercises you can do in any tool.",
    category: "Design",
    level: "ALL_LEVELS",
    price: 44.99,
    instructor: "lena@amber.test",
    publishedDaysAgo: 55,
    description:
      "Good design is not taste, it's a set of decisions you can learn to make.\n\nThis course covers the three fundamentals that do most of the work — **layout**, **typography** and **colour** — and gives you a repeatable process for each.",
    outcomes: [
      "Use spacing and alignment to create clear hierarchy",
      "Pair and size typefaces with a simple scale",
      "Build an accessible colour palette from one brand colour",
    ],
    requirements: ["Any design tool, or pen and paper"],
    audience: ["New designers", "Developers who want their work to look better"],
    sections: [
      { title: "Layout", lectures: [v("Hierarchy in three moves"), v("Spacing systems")] },
      { title: "Typography", lectures: [v("Choosing and pairing typefaces"), v("A type scale you'll reuse forever")] },
      {
        title: "Colour",
        lectures: [
          v("From one colour to a palette"),
          {
            kind: "quiz",
            title: "Check: contrast and accessibility",
            questions: [
              {
                prompt: "What is the minimum contrast ratio for normal body text under WCAG AA?",
                options: ["2:1", "3:1", "4.5:1", "7:1"],
                correct: [2],
                explanation: "AA requires 4.5:1 for normal text and 3:1 for large text.",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    title: "UI Design in Practice: From Wireframe to Prototype",
    subtitle: "Design a complete mobile app screen by screen and hand it off with confidence.",
    category: "Design",
    level: "BEGINNER",
    price: 34.99,
    instructor: "lena@amber.test",
    publishedDaysAgo: 20,
    description:
      "Follow one project from a rough idea to a clickable prototype. You'll sketch flows, build a small component library and test your design with real people before a single line of code is written.",
    outcomes: ["Turn a brief into user flows", "Build reusable components", "Create and test a clickable prototype"],
    requirements: ["A free account in any interface design tool"],
    audience: ["Aspiring product designers"],
    sections: [
      { title: "From brief to flows", lectures: [v("Understanding the problem"), v("Sketching flows quickly")] },
      { title: "Building the interface", lectures: [v("Components and variants"), v("Prototyping and testing")] },
    ],
  },
  {
    title: "Start a Small Business: From Idea to First Customer",
    subtitle: "Validate an idea, price it, and make your first sale without quitting your job.",
    category: "Business",
    level: "BEGINNER",
    price: 29.99,
    instructor: "samuel@amber.test",
    publishedDaysAgo: 75,
    description:
      "Most businesses don't fail because the product was bad. They fail because nobody checked whether anyone wanted it.\n\nThis course is a four-week plan for testing an idea cheaply, finding the first people who'll pay, and deciding what to do next based on evidence.",
    outcomes: [
      "Test demand before you build anything",
      "Set a first price you can defend",
      "Find and talk to your first ten customers",
    ],
    requirements: ["An idea, however rough"],
    audience: ["First-time founders", "Freelancers who want to productise their work"],
    sections: [
      { title: "Is it worth doing?", lectures: [v("The cheapest possible test"), v("Talking to customers without pitching")] },
      {
        title: "Getting paid",
        lectures: [
          v("Pricing your first offer"),
          {
            kind: "article",
            title: "Template: the one-page business plan",
            body: "Answer these six questions in one sentence each:\n\n1. **Who** is it for?\n2. **What problem** do they have?\n3. **How** do you solve it?\n4. **Why you**, and why now?\n5. **How do you reach** them?\n6. **What does it cost and earn**?\n\nIf any answer takes more than a sentence, that's the part to work on next.",
          },
          v("Your first ten customers"),
        ],
      },
    ],
  },
  {
    title: "Personal Finance Basics",
    subtitle: "A calm, practical introduction to budgeting, saving and avoiding expensive mistakes.",
    category: "Business",
    level: "ALL_LEVELS",
    price: 0,
    instructor: "samuel@amber.test",
    publishedDaysAgo: 40,
    description:
      "No jargon and no get-rich-quick promises: just the handful of habits that make the biggest difference, explained plainly.",
    outcomes: ["Build a budget you'll actually keep", "Set up an emergency fund", "Understand interest and debt"],
    requirements: ["None"],
    audience: ["Anyone who wants to feel more in control of their money"],
    sections: [
      { title: "Where the money goes", lectures: [v("A budget in twenty minutes"), v("Needs, wants and goals")] },
      { title: "Protecting yourself", lectures: [v("The emergency fund"), v("How interest works for and against you")] },
    ],
  },
  {
    title: "Public Speaking with Confidence",
    subtitle: "Prepare, structure and deliver talks people remember, even if speaking makes you nervous.",
    category: "Personal Development",
    level: "ALL_LEVELS",
    price: 24.99,
    instructor: "samuel@amber.test",
    publishedDaysAgo: 30,
    description:
      "Confident speakers aren't fearless, they're prepared. Learn a simple structure for any talk, techniques for managing nerves, and how to practise so that it shows.",
    outcomes: ["Structure any talk in fifteen minutes", "Manage nerves before and during a talk", "Use your voice and pauses deliberately"],
    requirements: ["A phone to record yourself practising"],
    audience: ["Professionals who present at work", "Students"],
    sections: [
      { title: "Preparation", lectures: [v("One idea, three points"), v("Openings and endings")] },
      { title: "Delivery", lectures: [v("Working with nerves"), v("Voice, pace and pauses")] },
    ],
  },
  {
    title: "Smartphone Photography",
    subtitle: "Take photos you're proud of with the camera you already carry.",
    category: "Photography & Video",
    level: "ALL_LEVELS",
    price: 19.99,
    instructor: "lena@amber.test",
    publishedDaysAgo: 15,
    description:
      "You don't need a new camera. You need to see light, frame deliberately and edit with restraint. Short lessons and a photo assignment after each one.",
    outcomes: ["Compose stronger photos", "Use natural light at any time of day", "Edit quickly on your phone"],
    requirements: ["Any smartphone"],
    audience: ["Hobbyists", "Small business owners photographing their products"],
    sections: [
      { title: "Seeing", lectures: [v("Composition in five rules"), v("Finding good light")] },
      { title: "Finishing", lectures: [v("A five-minute edit")] },
    ],
  },
  {
    title: "Email Marketing That Gets Opened",
    subtitle: "Write subject lines and sequences that earn attention instead of demanding it.",
    category: "Marketing",
    level: "BEGINNER",
    price: 27.99,
    instructor: "samuel@amber.test",
    status: "IN_REVIEW",
    description:
      "A practical guide to building a small, engaged list and writing emails people look forward to. Covers welcome sequences, subject lines and measuring what matters.",
    outcomes: ["Plan a welcome sequence", "Write subject lines that get opened", "Read your email metrics correctly"],
    requirements: ["An email tool account (any provider)"],
    audience: ["Small business owners", "Creators"],
    sections: [
      { title: "Foundations", lectures: [v("Why people open emails"), v("Your welcome sequence")] },
      { title: "Improving", lectures: [v("Subject lines"), v("Metrics that matter")] },
    ],
  },
  {
    title: "Advanced TypeScript Patterns",
    subtitle: "Generics, conditional types and API design for large codebases.",
    category: "Development",
    level: "ADVANCED",
    price: 54.99,
    instructor: "ada@amber.test",
    status: "DRAFT",
    description: "Work in progress.",
    outcomes: ["Design type-safe APIs"],
    requirements: [],
    audience: [],
    sections: [
      {
        title: "Generics in depth",
        lectures: [v("Constraints and inference"), { kind: "empty-video", title: "Variance (recording soon)" }],
      },
    ],
  },
];
