/* Extra detail for each step, in the same order as the steps in LESSONS (48 total). */
const DETAILS = [
  // 1. JVM – from source to running code
  [
    'javac produces platform-neutral bytecode. The JVM never sees your .java file.',
    'Loading finds the class bytes. Linking verifies the bytecode, prepares static fields and resolves references. Initialization runs static initializers.',
    'The Bootstrap loader (native, shown as null in Java) loads java.base. The Application loader loads your classpath.',
    'Two classes with the same name loaded by different loaders are different types. This is why ClassCastException can happen between "the same" class.'
  ],
  // 2. JVM – memory areas
  [
    'Each thread has its own stack. A frame is pushed on every method call and popped on return. Too deep a recursion throws StackOverflowError (size set with -Xss).',
    'The heap is shared by all threads. It is sized with -Xms and -Xmx. Objects are referenced from stack frames and from other objects.',
    'Metaspace stores class metadata in native memory (since Java 8, it replaced PermGen). Its limit is -XX:MaxMetaspaceSize.',
    '"Java heap space" and "Metaspace" are different OutOfMemoryError messages. Read which one you got before tuning anything.'
  ],
  // 3. JVM – mark and sweep
  [
    'GC roots include local variables on thread stacks, static fields, JNI references and running threads.',
    'The GC decides by reachability, not by reference counting. Cycles of objects that point only at each other are still collected.',
    'Sweeping frees the unmarked objects. Compacting then slides survivors together, which avoids fragmentation.',
    'A WeakReference is cleared once an object is only weakly reachable. This is how caches avoid holding memory forever.'
  ],
  // 4. JVM – generational GC
  [
    'The weak generational hypothesis: most objects die young. The heap is split by age to exploit this.',
    'A minor GC copies live objects from Eden and the active Survivor into the other Survivor. Each copy increments the object age.',
    'Objects are promoted to Old Gen after reaching the tenuring threshold (-XX:MaxTenuringThreshold). Old Gen is cleaned by mixed or major GCs.',
    'Modern collectors: G1 (default since Java 9), ZGC and Shenandoah, which target very short pauses. Watch them with -Xlog:gc* or jstat -gc.'
  ],
  // 5. Multithreading – ExecutorService
  [
    'Executors.newFixedThreadPool(n) bounds threads, but its queue is unbounded, so overload turns into memory growth.',
    'Executors.newCachedThreadPool creates threads without limit. Avoid it for uncontrolled load.',
    'submit() returns a Future and reports exceptions. execute() does not. Always call shutdown() and awaitTermination(), or the JVM may not exit.',
    'Size CPU-bound pools near the number of cores. IO-bound work can use more threads, or virtual threads (next topic).'
  ],
  // 6. Multithreading – CompletableFuture
  [
    'supplyAsync runs on the common ForkJoinPool by default. For blocking IO, pass your own executor so you do not starve the common pool.',
    'thenApply transforms a value. thenCompose chains another future (flatMap). thenCombine merges two independent futures.',
    'Handle errors with exceptionally() or handle(). join() throws unchecked exceptions, while get() throws checked ones.',
    'allOf(f1, f2, ...) waits for many futures to finish. Collect their results with join() afterward.'
  ],
  // 7. Multithreading – locks
  [
    'synchronized is simple and reentrant. It uses the object monitor, and wait()/notify() coordinate threads on it.',
    'ReentrantLock adds tryLock with a timeout, an optional fairness policy and multiple Condition objects.',
    'Always unlock in a finally block. Deadlock happens when threads wait on each other in a cycle. Acquiring locks in one fixed order prevents it.',
    'For a simple counter, prefer AtomicInteger, or ConcurrentHashMap for shared maps. They avoid explicit locks.'
  ],
  // 8. Multithreading – virtual threads
  [
    'Thread.ofVirtual().start(task) or Executors.newVirtualThreadPerTaskExecutor() (Java 21+).',
    'They suit blocking IO well: you can use plain blocking code per request, without reactive chains.',
    'Do not pool virtual threads. Create one per task. They are cheap enough to be disposable.',
    'Pinning: a blocking call inside a synchronized block can pin the carrier thread (Java 21). Prefer ReentrantLock in those spots.'
  ],
  // 9. Database – indexing
  [
    'Most engines use a B+ tree: leaves hold sorted keys and are linked, so range scans are fast.',
    'A composite index (a, b) helps queries on a, and on a plus b. It does not help queries on b alone (the leftmost-prefix rule).',
    'Indexes cost write speed, disk space and maintenance. Add them for real query patterns, not for every column.',
    'A covering index contains every column a query needs, so the table itself is never read.'
  ],
  // 10. Database – transactions
  [
    'Atomicity: all or nothing. Consistency: constraints still hold. Isolation: concurrent work does not interfere. Durability: committed data survives a crash (via a write-ahead log).',
    'Keep transactions short. Long transactions hold locks and slow down the whole system.',
    'In Spring, @Transactional works through a proxy. Calling a @Transactional method from the same class (self-invocation) bypasses it.',
    'By default Spring rolls back on unchecked exceptions (RuntimeException), not on checked ones. Use rollbackFor to change that.'
  ],
  // 11. Database – isolation levels
  [
    'Dirty read: you read data another transaction has not committed, and that transaction then rolls back.',
    'Non-repeatable read: the same row, read twice in one transaction, returns different values.',
    'Phantom read: the same query returns new rows on the second run because another transaction inserted them.',
    'Serializable behaves as if transactions ran one after another. It is implemented with locks or, in PostgreSQL, with SSI, which may ask you to retry on conflicts.'
  ],
  // 12. Database – query optimization
  [
    'The planner chooses a plan from table statistics. Keep them fresh (ANALYZE in PostgreSQL). Stale stats lead to bad plans.',
    'A function on an indexed column, such as WHERE lower(email) = ..., usually skips a plain index. Index the expression or store the value normalized.',
    'ORMs often cause N+1 queries: one query for the list, then one per row. Fix with JOIN FETCH or batch fetching.',
    'EXPLAIN ANALYZE shows estimated versus actual row counts. A large gap means the statistics are wrong.'
  ],
  // 13. Caching – cache-aside
  [
    'Spring offers @Cacheable and @CacheEvict, backed by Redis through spring-data-redis.',
    'Cache stampede: an expiring hot key causes many simultaneous misses. Mitigate with a lock per key or by refreshing early.',
    'Cache serialized DTOs, not JPA entities. Entities carry lazy-loading proxies and session state that do not belong in a cache.',
    'Negative caching: store "not found" for a short TTL, so repeated lookups of missing keys do not hit the database.'
  ],
  // 14. Caching – eviction
  [
    'In Java, LinkedHashMap with accessOrder = true and removeEldestEntry() gives you an LRU cache in a few lines.',
    'Caffeine uses W-TinyLFU, which often gets better hit rates than plain LRU. It is the usual in-process cache in Spring.',
    'Redis picks what to evict with maxmemory-policy, for example allkeys-lru, volatile-ttl or allkeys-lfu.',
    'Eviction is not expiry. TTL removes data by time. Eviction removes data only when memory is full.'
  ],
  // 15. Caching – distributed cache
  [
    'Redis Cluster divides keys into 16,384 hash slots. Each node owns a range of slots.',
    'A key with a {hashtag} section is hashed only on that part, so related keys land on the same slot.',
    'Multi-key commands fail across slots unless the keys share a hashtag.',
    'Replicas provide read scaling and failover. Replication is asynchronous, so recent writes can be lost on failover.',
    'A common setup is two levels: a small in-process cache (Caffeine) in front of Redis.'
  ],
  // 16. Caching – invalidation
  [
    'Options: TTL only; delete on write (usually the best); write-through (update cache during the write); write-behind (update cache first, write DB later).',
    'Race condition: a reader misses the cache, reads the old row, and writes it back after a concurrent update. A short TTL limits the damage.',
    'Versioned keys (for example user:42:v7) avoid explicit deletes. Bumping the version makes old entries unreachable.',
    'In a multi-instance setup, publish an invalidation message (Redis pub/sub or Kafka) so every instance clears its local cache.'
  ],
  // 17. Kafka – partitions
  [
    'Partitions are the unit of parallelism and of ordering. Order is guaranteed only within one partition.',
    'The key is hashed to choose the partition. Messages without a key are spread across partitions.',
    'Retention is by time or size. Reading a message does not delete it, so several groups can read the same data.',
    'Replication factor 3 with min.insync.replicas = 2 is a common durability setting.'
  ],
  // 18. Kafka – consumer groups
  [
    'A group can use at most one consumer per partition. Extra consumers sit idle, so partition count caps parallelism.',
    'When a consumer joins or leaves, the group rebalances partitions. Consumption pauses briefly during that.',
    'Each group keeps its own committed offsets, stored in the internal __consumer_offsets topic.',
    'Consumers that share a group.id share the work. Consumers with different group.ids each get every message.'
  ],
  // 19. Kafka – event-driven
  [
    'Events describe facts that happened (OrderPlaced). Commands ask for something to be done (ChargePayment). Keep the two apart in naming.',
    'Outbox pattern: write the event to an outbox table in the same DB transaction, then relay it to Kafka. This avoids the dual-write bug, where the DB commits but the publish fails.',
    'Delivery is usually at-least-once, so duplicates happen. Make consumers idempotent, for example by storing processed event IDs.',
    'Use a schema (Avro or Protobuf) with a schema registry, so producers and consumers can evolve safely.'
  ],
  // 20. Kafka – offsets
  [
    'auto.offset.reset decides where a new group starts when no committed offset exists: earliest or latest.',
    'Commit after processing for at-least-once delivery. Commit before processing for at-most-once, which can lose messages.',
    'Consumer lag = latest offset minus committed offset. It is the key metric to alert on.',
    'To replay, seek to an offset or a timestamp and reprocess. Make sure the consumer is idempotent before you do.'
  ],
  // 21. Microservices – API gateway
  [
    'Gateway jobs: TLS termination, authentication, rate limiting, routing and sometimes response aggregation.',
    'Options: Spring Cloud Gateway, Kong, NGINX, Apigee, or AWS API Gateway.',
    'Keep business logic out of the gateway. It should route and protect, not decide what an order is.',
    'A Backend-for-Frontend (BFF) is a gateway per client type, such as one for web and one for mobile, each shaped for its UI.'
  ],
  // 22. Microservices – service discovery
  [
    'Client-side discovery: the caller asks a registry (Eureka) and picks an instance itself. Server-side discovery: a load balancer or Kubernetes Service picks for the caller.',
    'Health checks and heartbeats remove dead instances from the registry.',
    'On Kubernetes, discovery is DNS: http://order-svc resolves to the Service, which load-balances across pods.',
    'Registration takes time, so calls can briefly reach a dead instance. Retries cover that gap.'
  ],
  // 23. Microservices – circuit breaker
  [
    'In Spring, Resilience4j provides @CircuitBreaker with a fallbackMethod.',
    'The breaker opens when the failure rate or slow-call rate over a sliding window passes a threshold.',
    'Layer the defenses: timeout, then retry with exponential backoff and jitter, then circuit breaker, then bulkhead (separate thread pools per dependency).',
    'Retry only idempotent operations. Retrying a payment without an idempotency key can charge the customer twice.'
  ],
  // 24. Microservices – saga
  [
    'Choreography: services react to each other\'s events. Orchestration: one coordinator tells each service what to do. Orchestration is easier to follow and to debug.',
    'Compensating actions must be idempotent, and they can fail too. Log them and retry until they succeed.',
    'A saga is not ACID. Other requests can see intermediate states, such as stock reserved but not yet shipped.',
    'Combine the outbox pattern with idempotency keys, so each step is reliable even under retries.'
  ],
  // 25. Security – authn vs authz
  [
    'Authentication covers credentials, MFA, and the session or token that follows.',
    'Authorization can be role-based (RBAC), attribute-based (ABAC), or ownership-based ("can this user edit this order?").',
    '401 means "not authenticated". 403 means "authenticated, but not allowed".',
    'Enforce authorization on the server. Hiding a button in the UI is not security.'
  ],
  // 26. Security – JWT
  [
    'Verify the signature, exp, iss and aud on every request. Reject alg = none.',
    'A JWT cannot be revoked before it expires unless you keep a denylist. Use short lifetimes plus refresh tokens.',
    'The payload is base64url-encoded, not encrypted. Anyone can read it, so keep secrets and personal data out.',
    'Use asymmetric signing (RS256 or ES256) when many services verify tokens. They need only the public key.'
  ],
  // 27. Security – OAuth2
  [
    'Four roles: resource owner (the user), client (your app), authorization server (issues tokens), resource server (the API).',
    'PKCE protects public clients, such as single-page apps and mobile apps, from stolen authorization codes.',
    'Scopes limit what an access token may do, for example read:orders but not write:orders.',
    'OpenID Connect adds an ID token on top of OAuth2 that tells the app who the user is.'
  ],
  // 28. Security – Spring Security filter chain
  [
    'Spring Security is a chain of servlet filters. Your own filter can be placed in it with addFilterBefore.',
    'A SecurityFilterChain bean defines URL rules, CSRF handling and session policy. APIs usually use stateless sessions.',
    '@EnableMethodSecurity turns on @PreAuthorize("hasRole(\'ADMIN\')") on individual methods.',
    'To see why a request was blocked, set logging.level.org.springframework.security to DEBUG.'
  ],
  // 29. System design – scaling
  [
    'Scaling out needs stateless app servers. Keep sessions in Redis or in the token, not in server memory.',
    'Vertical scaling has a hard ceiling, and resizing usually means downtime.',
    'Scale the database last. Add read replicas first. Shard only when replicas are no longer enough.',
    'Measure before adding machines. Find the bottleneck (CPU, DB connections, network, a slow query) first.'
  ],
  // 30. System design – load balancing
  [
    'Layer 4 balancers route by TCP/UDP. Layer 7 balancers route by HTTP content, such as path or header.',
    'Algorithms: round robin, least connections, least response time, and consistent hashing (useful for caches).',
    'Health checks take failed servers out of rotation automatically.',
    'Sticky sessions pin a user to one server. Avoid them when you can, because they make scaling and failover harder.'
  ],
  // 31. System design – rate limiting
  [
    'Token bucket allows short bursts. Leaky bucket smooths traffic out. Fixed window is simple but allows spikes at window edges. Sliding window is more accurate.',
    'Limit by user ID, API key or IP. Per-instance counters are simple, but a shared counter in Redis gives a true global limit.',
    'Return 429 Too Many Requests with a Retry-After header, so clients know when to come back.',
    'Enforce limits at the gateway first, then per endpoint where the cost differs. Resilience4j has a RateLimiter for the latter.'
  ],
  // 32. System design – sharding
  [
    'The shard key decides everything. A hot key sends most traffic to one shard.',
    'Modulo hashing moves most keys when you change the shard count. Consistent hashing moves only a fraction.',
    'Cross-shard joins and transactions become expensive or impossible. Design the data so most queries stay within one shard.',
    'Range-based and directory-based sharding are alternatives. Range is easy to reason about but risks hot ranges.'
  ],
  // 33. DevOps – Docker
  [
    'Multi-stage builds: compile with a full JDK in one stage, then copy only the jar into a slim JRE image.',
    'Layer caching: copy pom.xml or build.gradle and resolve dependencies before copying the source. Code changes then skip the dependency download.',
    'Do not run as root. Set a non-root USER in the Dockerfile.',
    'Containers are disposable. Store data in volumes or in external services such as managed databases.'
  ],
  // 34. DevOps – Kubernetes
  [
    'Deployment creates a ReplicaSet, which creates Pods. You rarely create Pods directly.',
    'Liveness probe restarts a stuck container. Readiness probe removes an unready pod from the Service, without restarting it.',
    'Requests tell the scheduler what a pod needs. Limits cap CPU and memory use.',
    'A Service gives pods a stable name and load-balances across the ready ones.'
  ],
  // 35. DevOps – CI/CD
  [
    'Build once, then promote the same artifact through dev, staging and production. Do not rebuild per environment.',
    'Short-lived branches and frequent merges to main fit CI best.',
    'Fail fast: run quick unit tests before slow integration tests.',
    'Secrets come from the CI secret store or a vault. Never commit them to the repository.'
  ],
  // 36. DevOps – rolling deployment
  [
    'In a Kubernetes Deployment, maxSurge and maxUnavailable control how fast pods are replaced.',
    'Blue-green: run two full environments and switch traffic at once. Rollback is just switching back.',
    'Canary: send about 5% of traffic to the new version, watch error rates and latency, then increase.',
    'During a rolling update, old and new versions run at the same time. Database changes must work with both.'
  ],
  // 37. Cloud – load balancing across zones
  [
    'An Availability Zone (AZ) is an isolated data center within a region. Spread instances over at least two, ideally three.',
    'Health checks route traffic away from a failed instance or zone.',
    'Traffic that crosses zones can add cost and latency, so keep it in mind for chatty services.',
    'Auto Scaling groups (AWS) and Virtual Machine Scale Sets (Azure) can span zones too.'
  ],
  // 38. Cloud – object storage
  [
    'Versioning keeps old copies of an object. Lifecycle rules move old objects to cheaper storage, such as S3 Glacier or Azure Archive.',
    'Presigned URLs (S3) or SAS tokens (Azure) grant time-limited access without sharing credentials.',
    'Public buckets are a common data leak. Turn on block-public-access by default.',
    'Azure Blob Storage uses containers and access tiers: Hot, Cool and Archive.'
  ],
  // 39. Cloud – auto scaling
  [
    'Target tracking keeps a metric near a value, for example average CPU at 70%.',
    'Scale out quickly, scale in slowly. Cooldown periods prevent the group from flapping up and down.',
    'A new instance must pass health checks before it takes traffic. Account for that warm-up time.',
    'For background workers, scaling on queue depth often works better than scaling on CPU.'
  ],
  // 40. Cloud – AWS and Azure map
  [
    'The concepts are the same on both clouds: compute, storage, networking, identity and managed databases.',
    'Azure groups resources in resource groups. AWS uses accounts, and IAM roles and policies control access.',
    'Pricing differs: AWS has Reserved Instances and Savings Plans, Azure has reservations and savings plans too. Compare the specific services.',
    'Spring Cloud AWS and Spring Cloud Azure integrate Spring with each cloud\'s services.'
  ],
  // 41. Observability – three pillars
  [
    'Logs are discrete events. They are rich in detail but expensive to store and search at scale.',
    'Metrics are aggregated numbers: counters, gauges and histograms (Prometheus, Micrometer). They are cheap and best for alerts.',
    'Traces show one request\'s path across services, with timing for each step. OpenTelemetry is the standard.',
    'Use RED for services (Rate, Errors, Duration) and USE for resources (Utilization, Saturation, Errors).'
  ],
  // 42. Observability – distributed tracing
  [
    'Context propagates in headers, for example the W3C traceparent header. Every service forwards it.',
    'Spring Boot 3 uses Micrometer Tracing with an OpenTelemetry exporter.',
    'Sampling keeps a fraction of traces (for example 1–10%) to control cost. Many systems keep all error traces.',
    'Spans carry attributes such as http.route and db.statement, which you can search on.'
  ],
  // 43. Observability – Grafana
  [
    'Grafana draws dashboards from data sources such as Prometheus (metrics), Loki (logs) and Tempo (traces).',
    'Look at percentiles (p95, p99), not just averages. An average hides the slow requests that users notice.',
    'An alert rule has a condition and a "for" duration. The duration stops one-off spikes from paging anyone.',
    'Build one dashboard per service with RED panels, so you can see at a glance what changed.'
  ],
  // 44. Observability – structured logs
  [
    'Log JSON with a fixed field set, using a logstash encoder or similar. Fields become searchable instead of being parsed from text.',
    'Put traceId and spanId into the MDC, so every log line carries them and can be joined with traces.',
    'Levels: ERROR needs action, WARN is recovered or suspicious, INFO records business events, DEBUG is for diagnosis.',
    'Never log passwords, tokens or card numbers. Mask them at the source.'
  ],
  // 45. Testing – pyramid
  [
    'Unit tests check one class or function with no Spring context. They run in milliseconds.',
    'Integration tests use real dependencies, such as a database or Kafka via Testcontainers, or Spring slice tests (@DataJpaTest, @WebMvcTest).',
    'End-to-end tests cover a few critical user journeys, run against a deployed environment.',
    'Flaky tests destroy trust in the suite. Fix them or delete them.'
  ],
  // 46. Testing – JUnit
  [
    'JUnit 5 (Jupiter) provides @Test, @BeforeEach, @AfterEach, @ParameterizedTest and @Nested.',
    'assertEquals and assertThrows are built in. AssertJ (assertThat(...)) reads more naturally.',
    'JUnit creates a new test instance per method by default. @TestInstance(PER_CLASS) changes that.',
    'Tests must be independent and must pass in any order. Shared state between tests causes failures that only show up sometimes.'
  ],
  // 47. Testing – Mockito
  [
    'A mock returns what you stub it to return. A spy wraps a real object and lets you override some methods.',
    'Use @Mock with @InjectMocks in plain unit tests, or @MockBean in Spring tests.',
    'Verify interactions only when the call itself is the behavior, such as "charge was called once". Over-mocking makes tests brittle.',
    'ArgumentCaptor lets you inspect what was passed to a mock.'
  ],
  // 48. Testing – Testcontainers
  [
    'Use @Testcontainers with @Container in JUnit 5. In Spring Boot 3.1+, @ServiceConnection wires the container URL into the app automatically.',
    'Share one container across test classes (a static container or the singleton pattern) to keep the suite fast.',
    'CI needs a Docker daemon available for the tests to run.',
    'Use the same database version as production, so SQL dialect bugs show up in tests instead of in production.'
  ]
];

/* A short, concrete example for each step, in the same order as DETAILS (48 total).
   Rendered verbatim inside a <pre> — HTML is escaped by the page before display. */
const EXAMPLES = [
  // 1. JVM – from source to running code
  `// Main.java — javac turns this into Main.class bytecode
public class Main {
    static { System.out.println("static init: once, on first use"); }

    public static void main(String[] args) {
        // Bootstrap -> Platform -> Application (parent delegation)
        System.out.println(Main.class.getClassLoader());
    }
}`,

  // 2. JVM – memory areas
  `public class MemoryDemo {
    static int counter = 0;                // class metadata / static field

    public static void main(String[] args) {
        int local = 42;                    // lives in main()'s stack frame
        Order order = new Order("A-1");    // object lives on the shared heap
    }
}`,

  // 3. JVM – mark and sweep
  `List<Order> orders = new ArrayList<>();
orders.add(new Order("A-1"));

orders = null;            // no reachable reference -> garbage, will be swept

// still reachable from a GC root, so it is never collected:
Order kept = new Order("A-2");`,

  // 4. JVM – generational GC
  `// java -Xms256m -Xmx256m -Xlog:gc* Main
for (int i = 0; i < 1_000_000; i++) {
    byte[] tmp = new byte[1024];   // dies young: freed by a minor GC
}
// long-lived objects survive a few GCs and get promoted to Old Gen`,

  // 5. Multithreading – ExecutorService
  `try (ExecutorService pool = Executors.newFixedThreadPool(3)) {
    for (int i = 1; i <= 5; i++) {
        int task = i;
        pool.submit(() -> System.out.println(
            "task " + task + " on " + Thread.currentThread().getName()));
    }
}   // close() shuts the pool down (Java 19+)`,

  // 6. Multithreading – CompletableFuture
  `var user   = CompletableFuture.supplyAsync(() -> getUser(42), ioPool);
var orders = CompletableFuture.supplyAsync(() -> getOrders(42), ioPool);

var summary = user.thenCombine(orders, (u, o) -> new Summary(u, o))
                   .exceptionally(ex -> Summary.empty());

Summary result = summary.join();   // blocks until both stages finish`,

  // 7. Multithreading – locks
  `private final ReentrantLock lock = new ReentrantLock();
private int counter = 0;

void increment() {
    lock.lock();
    try { counter++; }
    finally { lock.unlock(); }   // always unlock in a finally block
}`,

  // 8. Multithreading – virtual threads
  `try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
    for (int i = 0; i < 100_000; i++) {
        executor.submit(() -> {
            Thread.sleep(Duration.ofSeconds(1));  // unmounts, carrier stays free
            return 1;
        });
    }
}   // 100k virtual threads, only a few OS carrier threads`,

  // 9. Database – indexing
  `-- Seq Scan: reads every row
SELECT * FROM orders WHERE customer_id = 42;

CREATE INDEX idx_orders_customer ON orders (customer_id);

-- Index Scan: jumps straight to the matching rows
EXPLAIN ANALYZE SELECT * FROM orders WHERE customer_id = 42;`,

  // 10. Database – transactions
  `@Transactional   // Spring opens the tx, commits on success, rolls back on error
public void transfer(long from, long to, BigDecimal amount) {
    accountRepo.debit(from, amount);    // both statements...
    accountRepo.credit(to, amount);     // ...succeed or roll back together
}
// RuntimeException -> rollback by default; checked exceptions do not roll back`,

  // 11. Database – isolation levels
  `@Transactional(isolation = Isolation.READ_COMMITTED)   // PostgreSQL default
public BigDecimal balance(long id) { ... }

@Transactional(isolation = Isolation.REPEATABLE_READ)  // MySQL InnoDB default
public void closeBooks(long id) { ... }

@Transactional(isolation = Isolation.SERIALIZABLE)     // strictest: be ready to retry
public void transfer(long from, long to, BigDecimal amt) { ... }`,

  // 12. Database – query optimization
  `// N+1: one query for the orders, then one per customer (lazy loading)
List<Order> orders = orderRepo.findAll();
orders.forEach(o -> o.getCustomer().getName());

// Better: fetch the association in the same query
@Query("select o from Order o join fetch o.customer")
List<Order> findAllWithCustomer();`,

  // 13. Caching – cache-aside
  `@Cacheable(value = "users", key = "#id")   // GET, or load + SET on a miss
public User findUser(long id) {
    return userRepo.findById(id).orElseThrow();
}

@CacheEvict(value = "users", key = "#user.id")   // invalidate on write
public void update(User user) { userRepo.save(user); }`,

  // 14. Caching – eviction
  `// A 3-entry LRU cache in a few lines
Map<String, String> lru = new LinkedHashMap<>(16, 0.75f, true) {
    @Override protected boolean removeEldestEntry(Map.Entry<String, String> e) {
        return size() > 3;          // evict the least recently used entry
    }
};

lru.put("A", "1");
lru.get("A");                       // A is now the most recently used`,

  // 15. Caching – distributed cache
  `// All app instances read and write the same Redis keys
redis.opsForValue().set("user:42", dto, Duration.ofMinutes(10));
User cached = (User) redis.opsForValue().get("user:42");

// {hashtag} pins related keys to one hash slot (useful for multi-key ops)
redis.opsForValue().set("cart:{user:42}", cart);`,

  // 16. Caching – invalidation
  `@Transactional
public void updateUser(User user) {
    userRepo.save(user);
    redis.delete("user:" + user.getId());   // delete after the DB write
}
// Safety net: every cached entry also carries a TTL, so a missed
// invalidation heals itself after at most one TTL window.`,

  // 17. Kafka – partitions
  `var record = new ProducerRecord<>(
        "orders",          // topic
        "user-42",         // key: same key -> always the same partition
        "ORDER_PLACED");   // value

kafka.send(record);        // ordering is guaranteed per partition only`,

  // 18. Kafka – consumer groups
  `@KafkaListener(topics = "orders", groupId = "billing")
public void bill(String event) { ... }       // "billing" splits the partitions

@KafkaListener(topics = "orders", groupId = "analytics")
public void analyse(String event) { ... }    // its own group: every event again

// A 4th consumer in "billing" would sit idle (only 3 partitions).`,

  // 19. Kafka – event-driven
  `// Producer publishes a fact; it does not know who listens
kafka.send(new ProducerRecord<>("orders", orderId,
        new OrderPlaced(orderId)));

// Any number of services react on their own
@KafkaListener(topics = "orders", groupId = "inventory")
public void reserveStock(OrderPlaced e) { ... }`,

  // 20. Kafka – offsets
  `// Commit AFTER processing = at-least-once delivery
@KafkaListener(topics = "orders", groupId = "billing")
public void consume(ConsumerRecord<String, String> rec, Acknowledgment ack) {
    handle(rec.value());    // make it idempotent: duplicates can happen
    ack.acknowledge();      // committed offset advances here
}`,

  // 21. Microservices – API gateway
  `@Bean
RouteLocator routes(RouteLocatorBuilder b) {
    return b.routes()
        .route("orders", r -> r.path("/orders/**")
            .filters(f -> f.tokenRelay())      // auth, rate limit here
            .uri("lb://order-service"))        // discovered, not hard-coded
        .build();
}`,

  // 22. Microservices – service discovery
  `@Bean @LoadBalanced                 // resolves the service name for us
RestClient.Builder restClient() { return RestClient.builder(); }

// No IPs or ports in code: "order-service" comes from the registry
Order order = restClient.build().get()
        .uri("http://order-service/orders/42")
        .retrieve().body(Order.class);`,

  // 23. Microservices – circuit breaker
  `@CircuitBreaker(name = "payment", fallbackMethod = "fallback")
@Retry(name = "payment")           // retry only idempotent calls
public Receipt charge(long orderId, Money amount) {
    return gateway.charge(orderId, amount);
}

Receipt fallback(long orderId, Money amount, Throwable ex) {
    return Receipt.deferred(orderId);   // fail fast instead of piling up
}`,

  // 24. Microservices – saga
  `// Orchestrator: every step is a local transaction
try {
    inventory.reserve(orderId);      // step 1
    payment.charge(orderId);         // step 2
} catch (Exception e) {
    payment.refund(orderId);         // undo 2 (must be idempotent)
    inventory.release(orderId);      // undo 1
    throw e;
}`,

  // 25. Security – authn vs authz
  `@Bean
SecurityFilterChain api(HttpSecurity http) throws Exception {
    return http
        .oauth2Login(Customizer.withDefaults())            // authentication
        .authorizeHttpRequests(a -> a
            .requestMatchers("/orders/**").hasRole("USER") // authorization
            .anyRequest().authenticated())
        .build();
}`,

  // 26. Security – JWT
  `// Verify the signature first, then trust the claims
Jws<Claims> jws = Jwts.parser().verifyWith(publicKey).build()
                      .parseSignedClaims(token);

Claims c = jws.getPayload();
if (c.getExpiration().before(new Date())) throw new ExpiredTokenException();
String user = c.getSubject();   // payload is readable: never store secrets`,

  // 27. Security – OAuth2
  `// The app never sees the password; it only holds an access token
HttpHeaders headers = new HttpHeaders();
headers.setBearerAuth(accessToken);          // Authorization: Bearer <token>

var request = new HttpEntity<>(headers);
Order[] orders = restTemplate.exchange(
        "https://api.example.com/orders", HttpMethod.GET,
        request, Order[].class).getBody();`,

  // 28. Security – Spring Security filter chain
  `@Bean
SecurityFilterChain api(HttpSecurity http) throws Exception {
    return http
        .csrf(AbstractHttpConfigurer::disable)                 // stateless API
        .sessionManagement(s -> s.sessionCreationPolicy(STATELESS))
        .authorizeHttpRequests(a -> a
            .requestMatchers("/admin/**").hasRole("ADMIN")     // else 403
            .anyRequest().authenticated())                     // else 401
        .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)
        .build();
}`,

  // 29. System design – scaling
  `// Stateless app servers: any instance can serve any request
@Bean
public LettuceConnectionFactory sessionStore() {
    return new LettuceConnectionFactory("redis", 6379);   // sessions in Redis
}

// Now you can run N copies behind a load balancer and add more at will.`,

  // 30. System design – load balancing
  `@Bean @LoadBalanced                 // round robin across healthy instances
RestClient.Builder client() { return RestClient.builder(); }

for (int i = 0; i < 6; i++) {       // S1, S2, S3, S1, S2, S3
    client.build().get().uri("http://order-service/ping")
          .retrieve().toBodilessEntity();
}`,

  // 31. System design – rate limiting
  `@RateLimiter(name = "api", fallbackMethod = "tooManyRequests")
public List<Order> orders(long userId) { ... }

ResponseEntity<List<Order>> tooManyRequests(long userId, Throwable t) {
    return ResponseEntity.status(429)          // Too Many Requests
            .header("Retry-After", "1")        // token refills in 1s
            .build();
}`,

  // 32. System design – sharding
  `// A stable key picks the same shard every time
int shard = Math.floorMod(Long.hashCode(userId), 4);   // 0..3
DataSource ds = shards.get(shard);

try (Connection c = ds.getConnection();
     PreparedStatement ps = c.prepareStatement(
         "select * from orders where user_id = ?")) {
    ps.setLong(1, userId);
    ...
}
// Cross-shard joins and transactions are the expensive part.`,

  // 33. DevOps – Docker
  `FROM eclipse-temurin:21-jdk AS build
COPY pom.xml . && RUN mvn -q dependency:go-offline
COPY src ./src && RUN mvn -q package -DskipTests

FROM eclipse-temurin:21-jre
COPY --from=build /app/target/app.jar app.jar
USER 1001                         # never run as root
ENTRYPOINT ["java","-jar","/app.jar"]`,

  // 34. DevOps – Kubernetes
  `apiVersion: apps/v1
kind: Deployment
spec:
  replicas: 3                     # desired state; controller creates Pod 4
  template:
    spec:
      containers:
        - name: app
          image: myapp:1.2.0
          readinessProbe:         # unready -> removed from the Service
            httpGet: { path: /actuator/health/readiness, port: 8080 }`,

  // 35. DevOps – CI/CD
  `# .github/workflows/ci.yml — same shape in Jenkins or GitLab CI
jobs:
  pipeline:
    steps:
      - run: mvn -B verify                     # build + unit + integration
      - run: docker build -t myapp:$GITHUB_SHA .
      - run: docker push myapp:$GITHUB_SHA     # build once, promote it
      - run: kubectl set image deploy/app app=myapp:$GITHUB_SHA`,

  // 36. DevOps – rolling deployment
  `spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1          # one extra pod (v2) appears first
      maxUnavailable: 0    # never fewer than 3 ready pods
# t0: v1 v1 v1 -> t1: v2 v1 v1 -> t2: v2 v2 v1 -> t3: v2 v2 v2`,

  // 37. Cloud – load balancing across zones
  `// The app just calls one HTTPS endpoint; zones are invisible to it
String base = System.getenv("API_BASE_URL");   // https://api.myapp.com

Order[] orders = restClient.get()
        .uri(base + "/orders")
        .retrieve().body(Order[].class);
// ALB spreads this over AZ-a and AZ-b; one zone failing is unnoticeable.`,

  // 38. Cloud – object storage
  `// S3 / Blob: objects live under a key; "images/" is just a prefix
s3.putObject(PutObjectRequest.builder()
        .bucket("my-app-assets")
        .key("images/logo.png")
        .contentType("image/png")
        .build(), RequestBody.fromFile(file));

// Time-limited access without sharing credentials:
URL url = s3.utilities().getUrl(b -> b.bucket("my-app-assets").key("images/logo.png"));`,

  // 39. Cloud – auto scaling
  `// Expose a metric; the platform scales the group on it
@Scheduled(fixedDelay = 5_000)
public void publishQueueDepth() {
    meterRegistry.gauge("orders.queue.depth", orderQueue.size());
}

// policy: depth > 100 (or CPU > 70%) -> +instances, then scale in slowly`,

  // 40. Cloud – AWS and Azure map
  `// Same code, one interface, different starter + config per cloud
public interface ObjectStore {
    void put(String key, byte[] bytes);
}

// AWS:   spring-cloud-starter-aws      -> S3Client
// Azure: spring-cloud-azure-starter    -> BlobClient
// Inject ObjectStore and the provider stays behind the interface.`,

  // 41. Observability – three pillars
  `// All three signals from the same code path
log.info("order {} created", orderId);                    // log
meterRegistry.counter("orders.created").increment();      // metric

try (var span = tracer.nextSpan().name("chargeCard").start()) {  // trace
    payment.charge(orderId);
}`,

  // 42. Observability – distributed tracing
  `// Boot 3 + Micrometer Tracing picks up the incoming traceparent header
@Observed(name = "order.create")        // adds a span and its timing
public Order create(CreateOrder cmd) {
    var payment = paymentClient.charge(cmd);  // child span, same traceId
    return orderRepo.save(new Order(cmd, payment));
}   // trace 9f2c shows this hop inside the whole request`,

  // 43. Observability – Grafana
  `// Expose Prometheus metrics; Grafana queries them
@Bean
MeterRegistry meterRegistry() {
    return new PrometheusMeterRegistry(PrometheusConfig.DEFAULT);
}

// Alert rule: p99 latency above 500 ms for 5 minutes
// histogram_quantile(0.99,
//   rate(http_server_requests_seconds_bucket[5m])) > 0.5`,

  // 44. Observability – structured logs
  `// logback + logstash-encoder -> one JSON object per line
MDC.put("traceId", currentTraceId());   // added to every log line
MDC.put("userId", String.valueOf(userId));

log.info("order created");              // {"level":"INFO","traceId":"9f2c",...}

MDC.clear();                            // thread pools reuse threads: clear it`,

  // 45. Testing – pyramid
  `@Test                                    // unit: no Spring, milliseconds
void appliesDiscount() {
    var pricing = new PricingService();
    assertThat(pricing.total(new Order(100))).isEqualTo(90);
}

@SpringBootTest @Testcontainers           // integration: real Postgres
class OrderRepositoryIT { ... }`,

  // 46. Testing – JUnit
  `class OrderServiceTest {
    @BeforeAll  static void once()     { /* start DB container once */ }
    @BeforeEach void setUp()           { service = new OrderService(); }
    @Test       void createsOrder()    { assertThat(service.create(cmd)).isNotNull(); }
    @AfterEach  void tearDown()        { /* cleanup after every test */ }
    @AfterAll   static void closeAll() { /* stop the container */ }
}`,

  // 47. Testing – Mockito
  `@ExtendWith(MockitoExtension.class)
class OrderServiceTest {
    @Mock PaymentGateway gateway;        // fake collaborator
    @InjectMocks OrderService service;   // real code under test

    @Test void chargesOnce() {
        when(gateway.charge(any())).thenReturn(Receipt.ok());
        service.place(new Order(42, 30));
        verify(gateway, times(1)).charge(any());   // interaction checked
    }
}`,

  // 48. Testing – Testcontainers
  `@SpringBootTest
@Testcontainers
class OrderRepositoryTest {
    @Container @ServiceConnection          // Boot 3.1+ wires the URL for us
    static PostgreSQLContainer<?> db = new PostgreSQLContainer<>("postgres:16");

    @Autowired OrderRepository repo;       // runs against real Postgres

    @Test void findsByCustomer() { ... }
}`,
];
