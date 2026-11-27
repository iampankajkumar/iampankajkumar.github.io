/* Extra material from Rajat Gajbhiye's LinkedIn posts (read in Chrome), paraphrased.
   Salary figures, coupon codes and guide promotions were left out on purpose.
   The question lists come from his posts. The answers and hints are my own notes unless a bullet says otherwise.
   Runs after shrayansh.js: adds steps to existing topics, adds one topic, then rebuilds the step list. */
(function () {
  const SRC = 'Post by Rajat Gajbhiye, paraphrased.';
  const SRCQ = 'Questions from a post by Rajat Gajbhiye. The answers and hints are mine.';
  const topic = t => LESSONS.find(l => l.title === t);
  const COL = ['c-b', 'c-p', 'c-t', 'c-g', 'c-o'];
  const Q = (t, x, qs, hints, src) => ({
    t, x, src: src || SRCQ,
    draw: () => C(...qs.map((q, i) => B(q, COL[i % 5], '', i % 5))),
    more: hints
  });

  /* ---------- Caching ---------- */
  topic('Caching').steps.push({
    t: 'Three cache killers: penetration, breakdown, avalanche',
    x: 'At scale, databases rarely die from bugs. They die from cache failures. Three different failures, three different fixes.',
    src: SRC,
    draw: () => C(
      R(B('Penetration', 'c-r', 'keys that do not exist', 0), B('Breakdown', 'c-y', 'one hot key expires', 1), B('Avalanche', 'c-p', 'many keys expire together', 2)),
      Dn(3),
      R(B('Bloom filter, or cache the empty result', 'c-g', '', 4), B('Mutex, or logical expiry', 'c-g', '', 5), B('TTL jitter', 'c-g', '', 6))),
    more: [
      'Penetration: users keep asking for data that does not exist, such as userId = -1. Each request misses the cache and the database. An automated flood can take the database down. Fix: a Bloom filter in front blocks invalid keys, or cache the empty result for a short TTL.',
      'Breakdown (hot key expiry): a viral profile is read by a million users. At the moment its key expires, thousands of requests reach the database together. Fix: a mutex so only one request reloads, or logical expiration, which serves the stale value while one request refreshes it.',
      'Avalanche: many keys expire at the same time, or the cache restarts. Fix: add random jitter to TTLs so keys do not die together, and keep the cache highly available.',
      'Breakdown is the same problem as the cache stampede earlier in this topic.'
    ]
  });

  /* ---------- Kafka quiz ---------- */
  topic('Messaging (Kafka)').steps.push({
    t: 'Kafka: three of these nine statements are true',
    x: 'A confident-sounding paragraph about Kafka hides six mistakes. Green lines are true and red lines are wrong. Each wrong line is a common interview trap.',
    src: 'His quiz paragraph is from a post by Rajat Gajbhiye. The corrections are mine.',
    draw: () => R(
      B('Distributed append-only log', 'c-g', '', 0),
      B('Partitions, replicated across brokers', 'c-g', '', 1),
      B('Order kept across the whole topic', 'c-r', '', 2),
      B('Same group splits the partitions', 'c-g', '', 3),
      B('Double the consumers, double the throughput', 'c-r', '', 4),
      B('acks=1 is safe once the leader has it', 'c-r', '', 5),
      B('Deleted once every consumer has read it', 'c-r', '', 6),
      B('Auto-commit after processing, so nothing is lost', 'c-r', '', 7),
      B('Exactly-once includes the consumer database write', 'c-r', '', 8)),
    more: [
      'Order is kept only inside one partition, not across the topic.',
      'Throughput grows only until consumers equal partitions. Extra consumers sit idle.',
      'acks=1 can lose data if the leader fails before the followers copy the write. Use acks=all with min.insync.replicas.',
      'Kafka deletes by retention (time or size), not because consumers have read the message.',
      'Auto-commit commits on a timer during poll(), not after your code finishes. A crash can lose or repeat messages. Commit manually after processing.',
      'Exactly-once covers read-process-write inside Kafka. A write to an external database still needs idempotency or the outbox pattern.'
    ]
  });

  /* ---------- Interview scenarios ---------- */
  const sc = topic('Interview scenarios').steps;
  sc.push(
    Q('Build this live (2026 second rounds)', 'Second rounds now often open with building something live. The post lists the prompts. The approaches below are my notes.', [
      'A hit counter for the last 5 minutes. Then 10,000 hits land in one second.',
      'book(start, end) for a meeting room, no double booking, O(log n).',
      'A vending machine, and at minute 40 they add UPI payments.',
      'A job runner that sleeps until the next job. A sooner job is added.',
      'A top 10 leaderboard for 1 million players, scores change every second.',
      'AI-generated starter code. What do you check before building on it?'
    ], [
      'Hit counter: keep one counter per second in a circular array of 300 slots instead of storing every hit. A burst makes one slot hot, so use LongAdder or sharded counters.',
      'Booking: keep reservations in a TreeMap by start time. Check the floor and ceiling neighbors for overlap, which is O(log n).',
      'Vending machine: model the machine with the State pattern and put payment behind an interface. Adding UPI then means one new class, not edits across the code.',
      'Job runner: use a priority queue ordered by due time. When a sooner job arrives, wake the sleeping thread so it recomputes how long to wait. Otherwise the new job runs late.',
      'Leaderboard: a Redis sorted set (ZADD, then ZREVRANGE 0 9), or a bounded structure of the top 10 plus a map for updates.',
      'Generated code: check correctness on edge cases, thread safety, complexity, error handling, security and tests before you build on it.'
    ]),
    Q('Debug this in production (1)', 'The post lists fifteen situations where the code runs but behaves wrongly. These four come first. The explanations are mine.', [
      'Orders 4 and 5 of 5 are cancelled. A for-each removes them from an ArrayList. Nothing throws. What is left?',
      'toMap(Order::id, Order::coupon) throws NullPointerException, but no id is null.',
      'Reflection changes private final String env = "prod" to "test". The code still behaves as prod.',
      '8 threads share a TreeMap. Keys vanish and nothing throws.'
    ], [
      'Removing order 4 leaves size 4 with the iterator cursor at 4, so hasNext() is false and order 5 is never visited. Orders 1, 2, 3 and 5 remain, with no exception. Use removeIf or iterator.remove().',
      'Collectors.toMap merges values with HashMap.merge, which rejects null. The coupon is null, so it throws. Filter nulls or collect another way.',
      'A final String initialized with a constant is inlined by the compiler into every place that reads it. Changing the field afterward changes nothing for that code.',
      'TreeMap is not thread-safe. Use ConcurrentSkipListMap if you need a sorted concurrent map, or synchronize access.'
    ]),
    Q('Debug this in production (2)', 'The next four of the fifteen situations. The explanations are mine.', [
      '5 @Scheduled jobs. One now takes 10 minutes and the rest run late.',
      'A report of users who never referred anyone is empty. It uses NOT IN (SELECT referrer_id FROM users).',
      'A Postgres migration adds a column with DEFAULT gen_random_uuid() to a 200M-row table. Checkout freezes.',
      'Postgres: duplicates pass UNIQUE (tenant_id, external_id). Every duplicate has a NULL external_id.'
    ], [
      'Spring runs scheduled tasks on a single thread by default, so one slow job delays all the others. Raise the pool size (spring.task.scheduling.pool.size) or run jobs asynchronously.',
      'If the subquery returns even one NULL, NOT IN evaluates to unknown for every row and returns nothing. Use NOT EXISTS, or filter out NULLs.',
      'A volatile default such as gen_random_uuid() forces a full table rewrite under a lock, which blocks queries. Add a nullable column, backfill in batches, then add constraints.',
      'In Postgres, NULLs count as distinct in a unique constraint. Make the column NOT NULL, use a partial unique index, or use NULLS NOT DISTINCT (Postgres 15+).'
    ]),
    Q('Beyond the textbook: production-flavored questions', 'From his weekly list of ten questions that go past the textbook answer. These five are the most concept-heavy.', [
      'A user is banned at 10:00. Their JWT expires at 11:00. What happens at 10:30?',
      'A singleton bean has a prototype bean injected. You call it 100 times. How many prototypes?',
      'The heap is capped at 4 GB and never fills, but Kubernetes kills the pod at 4.5 GB. Where did the memory go?',
      'Two users click the last seat in the same second. Both get it.',
      'You add an index. Reads get faster and inserts get slower. Why?'
    ], [
      'The JWT is still valid until it expires, because the server checks only the signature. Use short lifetimes with refresh tokens, a denylist, or a check against the user store.',
      'One. The prototype is injected once, when the singleton is created. Use ObjectProvider, @Lookup or a scoped proxy to get a new one per call.',
      'Off-heap memory: Metaspace, thread stacks, direct buffers, the code cache and native libraries. Use container-aware sizing (-XX:MaxRAMPercentage) and Native Memory Tracking.',
      'Check-then-insert is a race. Use a unique constraint, a row lock (SELECT ... FOR UPDATE) or an optimistic version check.',
      'Each insert must also update every index. In PostgreSQL, pg_stat_user_indexes with idx_scan = 0 shows indexes nobody uses.'
    ]),
    Q('Hire screen: Core Java and Spring', 'The first ten of twenty questions from his "answer 16 of 20" post. The answers are mine.', [
      'A HashMap key\'s hashCode changes after insertion. What does get() return?',
      'Double-checked locking without volatile. What can the second thread see?',
      'ThreadLocal in a thread pool. Where is the leak?',
      'Two threads increment a shared long with no sync. Two reasons it is wrong.',
      '30 GB heap, 10 ms pause budget. G1 or ZGC?',
      '@Transactional on a private method.',
      'A @Transactional method calls a REQUIRES_NEW method in the same class.',
      'Two beans need each other through constructor injection.',
      '500 outbound HTTP calls a second: RestTemplate or WebClient?',
      'A checked exception inside a @Transactional method. Rollback?'
    ], [
      'Usually null, because the lookup goes to a different bucket. The entry stays in the map, unreachable: a leak.',
      'Instruction reordering can publish a non-null but partly constructed object. Declare the field volatile.',
      'Pool threads live a long time, so values stay attached. Call remove() in a finally block.',
      'Lost updates (read-modify-write is not atomic) and no visibility guarantee between threads. Use AtomicLong or LongAdder.',
      'ZGC. Its pauses stay short regardless of heap size. G1 treats the pause goal as a target, not a promise.',
      'The annotation is ignored, because the proxy cannot intercept a private method.',
      'One transaction. The call inside the class bypasses the proxy, so REQUIRES_NEW is never applied.',
      'Spring Boot 2.6 and later fail at startup on circular references by default.',
      'WebClient. RestTemplate blocks a thread per call and can exhaust the thread pool.',
      'No. By default only unchecked exceptions and errors roll back. Use rollbackFor for checked ones.'
    ]),
    Q('Hire screen: Kafka, database and system design', 'The last ten of twenty questions from the same post. The answers are mine.', [
      'A consumer processes a message and crashes before committing the offset.',
      'You add partitions to a live topic. What happens to per-key ordering?',
      'A producer retries after a timeout and the message lands twice.',
      '200 orders on a page, 201 queries in the log.',
      'Two transactions read one row, both update it, one update vanishes.',
      'Index on (status, created_at), but the query filters on created_at only.',
      'Hibernate second-level cache, two app instances. Instance B serves stale data.',
      'A rate limiter for a public API on 40 servers. Where does the counter live?',
      'A client retries a payment call after a timeout. How do you charge once?',
      'Email, SMS and push notifications. The SMS provider dies for 20 minutes.'
    ], [
      'The next consumer resumes from the last committed offset and sees the message again, so the consumer must be idempotent.',
      'The key-to-partition mapping changes, so new messages for a key can land in a different partition. Ordering across the change is lost.',
      'Set enable.idempotence=true on the producer.',
      'N+1 queries: one for the list plus one per order. Fix with a fetch join or @EntityGraph, or with batch fetching.',
      'A lost update. Prevent it with a @Version column (optimistic), a row lock (pessimistic) or an atomic UPDATE.',
      'Usually not, because of the leftmost-prefix rule. Put created_at first or add a separate index.',
      'Each instance holds its own local cache. Without a distributed cache provider or invalidation between instances, B keeps the old value.',
      'In a shared store such as Redis. The race is read-then-write, so use an atomic INCR or a Lua script.',
      'Require an idempotency key. Store it with a unique constraint and return the saved result on a repeat.',
      'Isolate each channel with its own queue and consumers, and add a circuit breaker and bulkhead. Email and push keep working while SMS retries later.'
    ])
  );

  /* ---------- Java interview checklist: streams ---------- */
  topic('Java interview checklist').steps.push(Q(
    'Streams: laziness and six follow-ups',
    'Everyone knows intermediate operations are lazy and terminal operations run the pipeline. Interviewers then ask six follow-ups. The post lists them. The answers are mine.', [
      'filter, map and forEach each print the element. In what order for "a", "b", "c"?',
      'Put sorted() between filter and map. What changes?',
      'List.of(1, 2, 3).stream().peek(System.out::println).count(). What prints?',
      'You call a terminal operation twice on one stream.',
      'forEach vs forEachOrdered on a parallel stream.',
      'optional.orElse(loadFromDb()) vs orElseGet(() -> loadFromDb()).'
    ], [
      'Each element travels through the whole pipeline before the next one starts: filter a, map a, forEach a, then b, then c.',
      'sorted() must see every element first, so all elements pass filter, then sorting happens, then map and forEach run on the sorted result.',
      'Nothing prints on Java 9 and later. count() can read the size directly from a sized source and skip the pipeline.',
      'IllegalStateException: the stream has already been operated upon or closed.',
      'forEach on a parallel stream gives no ordering guarantee. forEachOrdered respects the encounter order, at the cost of some parallelism.',
      'orElse evaluates its argument every time, so it calls the database even when a value is present. orElseGet runs the supplier only when needed.'
    ],
    'Questions from a post by Rajat Gajbhiye. The answers are mine.'));

  /* ---------- New topic: roadmap ---------- */
  const RM = 'His roadmap post "Clear every Java backend round", paraphrased.';
  const R6 = (t, x, items, more) => ({
    t, x, src: RM,
    draw: () => R(...items.map((it, i) => B(it, COL[i % 5], '', i))),
    more
  });
  LESSONS.push({
    title: 'Java backend roadmap', group: 'Six steps, in order',
    steps: [
      R6('Step 1: Core Java', 'Start with the language and the collections. The rest builds on this.',
        ['OOP, exceptions, generics', 'Collections and HashMap internals', 'Java 8 to 21 features'],
        ['OOP, exception handling and generics.', 'List, Set, Map and Queue, and how HashMap works inside.', 'Streams, lambdas, records, sealed classes and virtual threads.']),
      R6('Step 2: Advanced Java', 'Concurrency, the JVM and design patterns separate junior answers from senior ones.',
        ['Multithreading', 'JVM internals', 'Design patterns', 'Serialization, annotations, reflection'],
        ['Multithreading and concurrency: synchronized, locks, Atomic, volatile, executors.', 'JVM internals: heap, Metaspace, G1 vs ZGC, and reading a thread dump.', 'Design patterns: Singleton, Factory, Builder, Strategy, State, Observer.', 'Serialization, annotations and reflection.']),
      R6('Step 3: Spring', 'Understand what the framework does for you, then the data and security layers.',
        ['Spring Core and IoC', 'Spring Boot 3', 'REST APIs', 'Spring Data JPA', 'Spring Security'],
        ['Spring Core: IoC, the bean lifecycle and scopes.', 'Spring Boot 3: auto-configuration, starters and Actuator.', 'REST APIs with validation and one error contract through @ControllerAdvice.', 'Spring Data JPA and Hibernate: N+1, lazy loading, locking and transactions.', 'Spring Security: the JWT filter and OAuth2.']),
      R6('Step 4: Data and messaging', 'The systems your service talks to: SQL, a cache and a message broker.',
        ['SQL', 'Redis', 'Kafka'],
        ['SQL: joins, indexes, isolation levels, and reading an EXPLAIN plan.', 'Redis: cache-aside, TTL, and the three cache failures.', 'Kafka: partitions, consumer groups, offsets and at-least-once delivery.']),
      R6('Step 5: Testing and quality', 'Show that your code can be changed safely.',
        ['JUnit 5 and Mockito', 'Testcontainers', 'Logging and code quality'],
        ['JUnit 5 and Mockito, including the difference between mocking and stubbing.', 'Integration tests with Testcontainers.', 'Logging with SLF4J, clean code and SonarQube.']),
      R6('Step 6: DevOps essentials', 'You do not need to be a platform engineer, but you must know how your code ships.',
        ['Git and CI/CD', 'Docker and Kubernetes', 'One cloud'],
        ['Git and CI/CD with GitHub Actions.', 'Docker and Kubernetes basics.', 'One cloud: AWS, Azure or GCP.'])
    ]
  });

  // rebuild the flat list and redraw
  FLAT.length = 0;
  LESSONS.forEach((l, li) => l.steps.forEach((s, si) => FLAT.push({ li, si, l, s })));
  k = 0;
  render();
})();
