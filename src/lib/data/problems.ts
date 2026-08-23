import type { LLDProblem } from "@/lib/types";

export const LLD_PROBLEMS: LLDProblem[] = [
  {
    id: "parking-lot",
    title: "Parking Lot System",
    difficulty: "Medium",
    description:
      "Design a parking lot system that supports multiple floors, different vehicle types (car, bike, truck), spot allocation, ticketing, and payment processing.",
    requirements: [
      "Multiple floors with N spots each",
      "Spot types: Compact, Large, Handicapped, Motorcycle",
      "Vehicles are assigned the nearest compatible free spot",
      "Ticket issued on entry with timestamp; fee computed on exit",
      "Support hourly and flat-rate pricing strategies",
    ],
    useCases: [
      "Vehicle enters → system allocates spot → ticket issued",
      "Vehicle exits → fee calculated → payment processed → spot freed",
      "Admin queries occupancy per floor",
    ],
    expectedClasses: [
      "ParkingLot",
      "Floor",
      "ParkingSpot",
      "Vehicle",
      "Ticket",
      "PaymentStrategy",
      "EntranceGate",
      "ExitGate",
    ],
  },
  {
    id: "elevator",
    title: "Elevator System",
    difficulty: "Medium",
    description:
      "Design an elevator control system for a building with multiple elevators. Handle external hall calls and internal cabin requests with an efficient scheduling strategy.",
    requirements: [
      "Multiple elevator cars serving M floors",
      "Hall calls (up/down) and cabin destination requests",
      "Scheduling strategy: nearest-car or SCAN algorithm",
      "Elevator state machine: Idle, MovingUp, MovingDown, DoorsOpen, Maintenance",
      "Handle overload and emergency stop",
    ],
    useCases: [
      "Passenger presses hall call → dispatcher assigns car",
      "Car arrives → doors open → passenger selects destination",
      "System rebalances idle cars to high-traffic floors",
    ],
    expectedClasses: [
      "ElevatorSystem",
      "ElevatorCar",
      "ElevatorState",
      "Request",
      "Dispatcher",
      "SchedulingStrategy",
      "Door",
      "Display",
    ],
  },
  {
    id: "rate-limiter",
    title: "Rate Limiter",
    difficulty: "Hard",
    description:
      "Design a distributed rate limiter supporting multiple algorithms (token bucket, sliding window log, fixed window counter) with per-client quotas.",
    requirements: [
      "Pluggable algorithm via Strategy pattern",
      "Per-client and per-endpoint limits",
      "Thread-safe / distributed-safe counters",
      "Return remaining quota and retry-after metadata",
    ],
    useCases: [
      "Request arrives → limiter checks quota → allow or reject (429)",
      "Admin updates limits at runtime without restart",
    ],
    expectedClasses: [
      "RateLimiter",
      "RateLimitAlgorithm",
      "TokenBucket",
      "SlidingWindowLog",
      "FixedWindowCounter",
      "ClientQuota",
      "RateLimitResult",
    ],
  },
  {
    id: "chess",
    title: "Chess Game",
    difficulty: "Hard",
    description:
      "Design an object-oriented chess game supporting move validation, check/checkmate detection, castling, en passant, and promotion.",
    requirements: [
      "8x8 board with piece hierarchy (King, Queen, Rook, Bishop, Knight, Pawn)",
      "Move validation per piece movement rules",
      "Detect check, checkmate, and stalemate",
      "Special moves: castling, en passant, pawn promotion",
      "Track move history for undo",
    ],
    useCases: [
      "Player selects piece → legal moves highlighted",
      "Player moves → board updates → game status re-evaluated",
    ],
    expectedClasses: [
      "Game",
      "Board",
      "Cell",
      "Piece",
      "Move",
      "Player",
      "MoveValidator",
    ],
  },
  {
    id: "splitwise",
    title: "Expense Sharing (Splitwise)",
    difficulty: "Easy",
    description:
      "Design an expense-sharing app where users split bills equally, by exact amounts, or by percentage, and balances are simplified to minimize transactions.",
    requirements: [
      "Users and groups",
      "Split types: Equal, Exact, Percent",
      "Balance sheet per user pair",
      "Simplify debts (minimize number of settlements)",
    ],
    useCases: [
      "User adds expense with split config → balances updated",
      "User settles up → transaction recorded",
    ],
    expectedClasses: [
      "ExpenseManager",
      "User",
      "Group",
      "Expense",
      "Split",
      "BalanceSheet",
    ],
  },
  {
    id: "bookmyshow",
    title: "Movie Ticket Booking",
    difficulty: "Hard",
    description:
      "Design a movie ticket booking platform with theatres, screens, shows, seat inventory with locking, and payment integration.",
    requirements: [
      "City → Theatre → Screen → Show hierarchy",
      "Seat categories with per-show pricing",
      "Temporary seat lock during checkout (TTL)",
      "Concurrent booking safety",
    ],
    useCases: [
      "User browses shows by city/movie",
      "User selects seats → seats locked → payment → booking confirmed",
    ],
    expectedClasses: [
      "BookingService",
      "Movie",
      "Theatre",
      "Screen",
      "Show",
      "Seat",
      "Booking",
      "SeatLock",
      "Payment",
    ],
  },
];
