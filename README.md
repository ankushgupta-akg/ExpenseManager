# Expense Manager Bot

A WhatsApp-powered expense tracking and splitting bot that helps groups manage shared expenses effortlessly. The bot uses AI to parse natural language expense messages and automatically calculates who owes whom.

## Features

- **Natural Language Processing**: Add expenses using conversational messages like "I paid 500 for dinner with Rahul and Priya"
- **Automatic Split Calculation**: Intelligent expense splitting with support for equal and custom splits
- **Balance Tracking**: View who owes you and what you owe others
- **Debt Simplification**: Get optimized settlement suggestions to minimize transactions
- **Group Management**: Automatic user registration and group creation
- **Duplicate Detection**: Prevents accidental duplicate expense entries
- **Session-based Conversations**: Multi-step conversations for complex expense entries

## Tech Stack

- **Backend**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL with Prisma ORM
- **AI Integration**: Groq API (Llama 3) for natural language processing
- **Messaging**: Twilio WhatsApp API
- **Caching**: Redis (with in-memory fallback)
- **Validation**: Zod for schema validation
- **Rate Limiting**: Custom in-memory rate limiter

## Architecture

```
src/
├── controllers/          # HTTP request handlers
├── services/             # Business logic layer
├── repositories/         # Data access layer
├── integrations/         # External service integrations
├── utils/               # Utility functions
├── validators/          # Schema validation
└── config/              # Configuration management
```

## Getting Started

### Prerequisites

- Node.js 18+ 
- PostgreSQL database
- Twilio account with WhatsApp sandbox
- Groq API key

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd expense-manager-bot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your configuration:
   ```env
   # Database
   DATABASE_URL="postgresql://username:password@localhost:5432/expense_manager"
   
   # Server
   PORT=3000
   
   # AI Integration
   GROQ_API_KEY="your-groq-api-key"
   GROQ_MODEL="llama3-8b-8192"
   AI_TIMEOUT_MS=10000
   AI_MAX_RETRIES=2
   
   # Twilio WhatsApp
   TWILIO_ACCOUNT_SID="your-account-sid"
   TWILIO_AUTH_TOKEN="your-auth-token"
   TWILIO_PHONE_NUMBER="your-twilio-phone"
   
   # Rate Limiting
   RATE_LIMIT_MAX_REQUESTS=100
   RATE_LIMIT_WINDOW_MS=60000
   
   # Redis (optional)
   REDIS_URL=""
   
   # Session & Lock Management
   SESSION_TTL_SECONDS=300
   USER_LOCK_TTL_MS=15000
   ```

4. **Set up the database**
   ```bash
   npx prisma migrate dev
   npx prisma generate
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

6. **Deploy to production**
   ```bash
   npm run build
   npm start
   ```

## Usage

### Basic Commands

Send these messages to your WhatsApp bot:

**Add an expense:**
- "I paid 500 for dinner with Rahul and Priya"
- "Paid 200 for movie tickets with team"
- "1000 for groceries split equally with family"

**Check balances:**
- "What do I owe?" - Shows your payables
- "Who owes me?" - Shows your receivables  
- "Show balance" - Shows net balances

**Settle debts:**
- "Simplify debts" - Get optimized settlement suggestions

### Advanced Features

**Custom splits:**
- "I paid 600 for dinner, I pay 300, Rahul pays 200, Priya pays 100"

**Percentage splits:**
- "Paid 1000 for trip, I pay 50%, Rahul 30%, Priya 20%"

**Multi-step conversations:**
- Start with "hi" and follow the prompts for complex expense entries

## API Endpoints

### Webhook Endpoint
```
POST /webhook/whatsapp
```
Receives incoming WhatsApp messages from Twilio.

### Health Check
```
GET /health
```
Returns service health status.

## Database Schema

The application uses the following main entities:

- **User**: Stores user information and phone numbers
- **Group**: Manages expense groups
- **GroupMember**: Links users to groups
- **Expense**: Records expense transactions
- **Split**: Tracks individual expense splits

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3000 |
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `GROQ_API_KEY` | Groq API key for AI processing | Required |
| `GROQ_MODEL` | AI model name | llama3-8b-8192 |
| `AI_TIMEOUT_MS` | AI request timeout | 10000 |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | 100 |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window | 60000 |
| `SESSION_TTL_SECONDS` | Session expiration | 300 |
| `USER_LOCK_TTL_MS` | User lock duration | 15000 |

## Development

### Project Structure

- **Controllers**: Handle HTTP requests and responses
- **Services**: Contain business logic and orchestration
- **Repositories**: Handle database operations
- **Integrations**: Manage external API connections
- **Utils**: Shared utility functions
- **Validators**: Schema validation using Zod

### Key Services

- **ExpenseService**: Core expense processing logic
- **AIService**: Natural language processing
- **SessionService**: User conversation state management
- **LockService**: Prevents concurrent operations
- **FinancialService**: Balance calculations and settlements

### Running Tests

```bash
npm test
```

### Code Quality

The project uses:
- TypeScript for type safety
- ESLint for code linting
- Prettier for code formatting
- Zod for runtime validation

## Deployment

### Docker Deployment

```bash
docker-compose up -d
```

### Production Considerations

- Use PostgreSQL for production database
- Configure Redis for session storage
- Set up proper logging and monitoring
- Configure webhook security
- Set up database backups
- Use environment-specific configurations

## Security

- Input validation using Zod schemas
- Rate limiting to prevent abuse
- User locks to prevent race conditions
- Environment variable validation
- Secure webhook handling

## Monitoring

The application includes structured logging for:
- Request/response tracking
- Error reporting
- Performance monitoring
- User activity auditing

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For issues and questions:
- Create an issue on GitHub
- Check the logs for error details
- Review the environment configuration

## Roadmap

- [ ] Web dashboard for expense management
- [ ] Expense categories and budgets
- [ ] Recurring expenses
- [ ] Receipt image processing
- [ ] Multi-currency support
- [ ] Export functionality
- [ ] Advanced reporting