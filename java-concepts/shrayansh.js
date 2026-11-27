/* Extra lessons built from Shrayansh Jain's LinkedIn posts (read in Chrome).
   Runs after the main script: it attaches the original detail bullets, inserts new steps
   into existing topics, adds three new topics, then rebuilds the step list. */
(function () {
  // 1. keep each original step's detail bullets with the step itself, so inserting steps is safe
  let di = 0;
  LESSONS.forEach(l => l.steps.forEach(s => {
    s.more = DETAILS[di];
    if (typeof EXAMPLES !== 'undefined') s.ex = EXAMPLES[di];
    di++;
  }));
  const topic = t => LESSONS.find(l => l.title === t);

  /* ---------- JVM: reference types ---------- */
  topic('JVM Internals').steps.push({
    t: 'GC reference types: strong, soft, weak, phantom',
    x: 'Not every reference keeps an object alive the same way. The reference type tells the GC how willing it should be to collect the object.',
    src: 'Topic from his post about Java GC reference types (the post is an image). The explanation here is mine.',
    draw: () => R(
      B('Strong', 'c-g', 'never collected while reachable', 0),
      B('Soft', 'c-y', 'cleared when memory runs low', 1),
      B('Weak', 'c-o', 'cleared at the next GC', 2),
      B('Phantom', 'c-m', 'cleanup after the object is gone', 3)),
    more: [
      'Strong: a normal reference such as Order o = new Order(). The object stays alive while any strong path exists.',
      'SoftReference: good for memory-sensitive caches. The JVM clears soft references before it throws OutOfMemoryError.',
      'WeakReference: WeakHashMap uses it, so an entry disappears once its key has no strong references left.',
      'PhantomReference: get() always returns null. Pair it with a ReferenceQueue to run cleanup after collection. Cleaner replaces the old finalize().'
    ]
  });

  /* ---------- Caching: stampede ---------- */
  topic('Caching').steps.push(
    {
      t: 'Cache stampede: when the cache hurts',
      x: 'A popular key expires and many requests see the miss at the same moment. All of them go to the database, which then gets a traffic spike instead of protection.',
      src: 'A post he shared (written by Chris Dias), paraphrased.',
      draw: () => C(
        R(B('Popular key expires', 'c-y', 'Redis', 0), A(0), B('Many requests miss', 'c-r', 'at the same moment', 1), A(1), B('Database', 'c-r', 'a million requests, may go down', 2)),
        N('The most dangerous moment for the database is when the cache stops helping.')),
      more: [
        'A cache is not only about faster reads. Plan for what happens when it misses, expires or is unavailable.',
        'The effect is sharpest on hot keys: one key, thousands of readers, one slow query behind it.',
        'Next step: four ways to stop it.'
      ]
    },
    {
      t: 'Four defenses against a stampede',
      x: 'Let one request refill the cache, keep serving old data while it does, and make sure keys do not all expire together.',
      src: 'The same shared post, paraphrased. The Java hints in the bullets are mine.',
      draw: () => R(
        B('1. Singleflight', 'c-b', 'one request fetches, the rest wait for it', 0),
        B('2. Distributed lock', 'c-p', 'one server regenerates (Redis lock)', 1),
        B('3. Stale-while-revalidate', 'c-t', 'serve the old value, refresh in background', 2),
        B('4. TTL jitter', 'c-g', 'randomize expiry times', 3)),
      more: [
        'Singleflight (request coalescing): keep one in-flight future per key. The other requests wait on it and reuse the result. In Java, a ConcurrentHashMap of CompletableFuture, or Caffeine, which loads each key once.',
        'Catch: that map lives in one process. With 10 app servers you can still get 10 database calls for the same key.',
        'Distributed lock: a Redis lock (SET key value NX PX ttl) lets only one server regenerate the entry while the others wait or serve stale data.',
        'Stale-while-revalidate: if an older value exists, return it and refresh in the background. Caffeine offers refreshAfterWrite for this.',
        'TTL jitter: add a random amount to each TTL, for example base plus 0 to 10 percent, so thousands of keys do not expire in the same second.'
      ]
    });

  /* ---------- Messaging: topics vs groups, outbox ---------- */
  topic('Messaging (Kafka)').steps.push(
    {
      t: 'Same topic with many groups, or many topics?',
      x: 'A topic is not tied to one consumer group. Several groups can read it independently, each with its own offsets. Pick separate topics only when the streams really differ.',
      src: 'His post on this choice, plus a second post he shared (by Tanmaya Khandelwal), paraphrased.',
      draw: () => C(
        R(B('Topic: new_messages', 'c-b', '', 0), A(0), C(B('Group: chat-gateway', 'c-g', 'own offsets', 1), B('Group: notifications', 'c-g', 'own offsets', 2), B('Group: analytics', 'c-g', 'own offsets', 3))),
        N('Same topic, different groups: each service needs every event independently.'),
        N('Different topics: different event types, retention, access control or separate streams.')),
      more: [
        'Same group: Kafka splits the partitions between the consumers, so each message is handled by one of them. This is how you scale one service out.',
        'Different groups: every group gets every message. This is how you broadcast to different services.',
        'Example: a new_messages topic read by a chat gateway, a notification service and an analytics service needs one group per service. Putting all three consumers in one group would split the messages between them.',
        'Use separate topics when retention periods, access rules or event types differ between consumers.'
      ]
    },
    {
      t: 'Transactional outbox: do not lose events',
      x: 'Saving to the database and publishing to Kafka are two systems with no shared transaction. If the app crashes between them, the data is saved but the event is gone. The outbox pattern fixes that.',
      src: 'A post he shared (written by Purushotham Ankalappa Gari), paraphrased.',
      draw: () => C(
        N('Dual-write problem: DB commit succeeds, the app dies, Kafka never hears about it.'),
        R(B('1. One DB transaction', 'c-g', 'business row + outbox row', 0), A(0), B('2. Outbox publisher', 'c-b', 'reads pending rows', 1), A(1), B('3. Publish to Kafka', 'c-y', 'then mark as sent', 2), A(2), B('4. Consumer', 'c-p', 'sends the notification', 3))),
      more: [
        'Both rows commit together or neither does, so the event is always safe in the database.',
        'The publisher can be a scheduled worker, or change-data-capture such as Debezium reading the outbox table.',
        'Trade-off: delivery is at-least-once. A crash after publishing but before marking as sent causes a duplicate.',
        'Make consumers idempotent, for example by storing processed event IDs and ignoring repeats.'
      ]
    });

  topic('Messaging (Kafka)').steps.push({
    t: 'Kafka: 10 frequently asked interview questions',
    x: 'A graphic from his Kafka post lists ten questions that come up in interviews and daily work. Each one maps to a failure or design choice you can reason about.',
    src: 'His image post "Apache Kafka: 10 Frequently Asked Interview Questions" (the graphic lists the questions only). The answers are mine.',
    draw: () => R(...['Duplicate processing', 'Message ordering', 'Consumer lag', 'Consumer failure', 'Poison messages', 'Retry mechanism', 'Partition rebalancing', 'Delivery semantics', 'Kafka vs RabbitMQ', 'Schema evolution']
      .map((q, i) => B((i + 1) + '. ' + q, ['c-b', 'c-p', 'c-t', 'c-g', 'c-o'][i % 5], '', i % 5))),
    more: [
      'Duplicates: delivery is at-least-once, so make the consumer idempotent. Deduplicate on an event ID or a unique constraint.',
      'Ordering: Kafka orders messages within one partition only. Use the same key for related messages. Enable the idempotent producer to keep order when the producer retries.',
      'Consumer lag: caused by slow processing, too few consumers or partitions, or frequent rebalances. Check lag per partition, speed up the handler, tune max.poll.records, and add consumers up to the partition count.',
      'Consumer failure: if it crashes after processing but before committing the offset, the message is processed again after restart. Idempotency covers this.',
      'Poison messages: after a few retries, send the message to a dead letter topic and move on, so one bad message does not block the partition.',
      'Retries: use exponential backoff, retry topics with delays, and a dead letter topic after the last attempt (Spring Kafka has @RetryableTopic).',
      'Rebalancing: when a consumer joins or leaves, partitions are reassigned and consumption pauses. Cooperative rebalancing and static membership reduce the disruption.',
      'Delivery semantics: commit before processing gives at-most-once, commit after gives at-least-once, and the idempotent producer plus transactions give exactly-once inside Kafka.',
      'Kafka vs RabbitMQ: Kafka is a replayable log with high throughput where consumers pull. RabbitMQ is a broker with flexible routing where messages are removed after acknowledgment.',
      'Schema evolution: use Avro or Protobuf with a schema registry and a compatibility rule. Add optional fields with defaults and do not remove required ones.'
    ]
  });

  /* ---------- New topic: scenario questions ---------- */
  const Q = (t, qs, hints, src) => ({
    t, x: 'Questions from his post about real situations interviewers ask about. The post lists only the questions. The hints below are my starting points, not his answers.',
    src: src || 'His post "Imagine these situations", questions only. Hints are mine.',
    draw: () => C(...qs.map((q, i) => B(q, ['c-b', 'c-p', 'c-t'][i], '', i))),
    more: hints
  });
  LESSONS.push({
    title: 'Interview scenarios', group: 'Real problems from his posts',
    steps: [
      Q('Concurrency scenarios', [
        'HashMap keeps growing. How do you investigate the slowdown?',
        'synchronized blocks everywhere. How do you find unnecessary contention?',
        'A Singleton is initialized by several threads. How does double-checked locking help?'
      ], [
        'Growing map: take a heap dump or a class histogram (jcmd GC.class_histogram). Look for keys without proper equals/hashCode, caches with no eviction, and heavy collisions.',
        'Contention: take several thread dumps (jstack) and look for many BLOCKED threads on the same monitor. JFR also records lock contention. Then shrink critical sections or use ConcurrentHashMap, atomics or ReadWriteLock.',
        'Double-checked locking: check null without a lock, then lock and check again before creating. The field must be volatile, or another thread can see a half-built object. An enum singleton or a holder class avoids the problem.'
      ]),
      Q('JVM and GC scenarios', [
        'Runs fine for weeks, then OutOfMemoryError. Where do you look?',
        'Frequent Full GC freezes the app for seconds. How do you troubleshoot?',
        'G1GC or ZGC? What drives the choice in production?'
      ], [
        'OOM: start the JVM with -XX:+HeapDumpOnOutOfMemoryError and open the dump in Eclipse MAT. Common leaks are static collections, listeners that are never removed and ThreadLocals. Read the error message too: heap space and Metaspace are different problems.',
        'Full GC: turn on GC logs (-Xlog:gc*) and see what triggered each one: old gen full, Metaspace, promotion failure or an explicit System.gc(). If old gen stays high after each collection, suspect a leak.',
        'G1 is the balanced default. ZGC and Shenandoah target very low pauses on large heaps and may cost some throughput. Decide with your latency target and heap size, and measure with realistic load.'
      ]),
      Q('Spring Boot scenarios', [
        '@Transactional is present but the transaction does not work. Why?',
        'Several beans implement the same interface. How does Spring choose?',
        'Startup takes 45 seconds. How do you find the bottleneck?'
      ], [
        '@Transactional works through a proxy. It is skipped for self-invocation, for private or final methods, for objects that are not Spring beans, and rolls back only on unchecked exceptions by default.',
        'Spring throws NoUniqueBeanDefinitionException. Resolve it with @Primary, @Qualifier, a matching parameter name, or inject a List or Map of all implementations.',
        'Use the startup actuator endpoint (BufferingApplicationStartup) to see slow beans. Also check a huge component scan, slow database connections at startup, schema validation, and consider lazy initialization.'
      ]),
      Q('Database and JPA scenarios', [
        'Lazy loading works locally but fails in production. What differs?',
        'A query is fine with 100 rows but crawls at 1 million. What do you inspect?',
        'Two users update the same record at once. How do you prevent lost updates?'
      ], [
        'LazyInitializationException appears when you touch a lazy field outside a session. Check spring.jpa.open-in-view and transaction boundaries between environments. Fix with a fetch join, @EntityGraph or a DTO projection.',
        'Run EXPLAIN ANALYZE. Look for a sequential scan, a missing index, N+1 queries and deep OFFSET pagination (keyset pagination scales better).',
        'Optimistic locking with a @Version column, a pessimistic lock (SELECT ... FOR UPDATE), or an atomic update such as UPDATE ... SET balance = balance - ?.'
      ]),
      Q('System design and production scenarios', [
        'A network retry submits a payment twice. How do you guarantee idempotency?',
        'One microservice is down while another keeps calling it. How do you stop cascading failures?',
        'Redis is enabled but the database is still overloaded. What is going wrong?'
      ], [
        'Require an idempotency key. Store it with a unique constraint and the result, and return the stored result when the same key arrives again.',
        'Timeouts, circuit breaker, bulkheads, retries with backoff and jitter, and a fallback. Also apply backpressure or rate limiting on the caller side.',
        'Check the hit ratio first. Causes: TTL too short, poor key design, a stampede on hot keys, requests for missing keys that always miss (cache penetration, use negative caching or a Bloom filter), memory evictions, or code paths that skip the cache.'
      ])
    ]
  });

  /* ---------- New topic: Java interview checklist ---------- */
  const K = (t, items, hints, src) => ({
    t, x: 'Topics from his Java and Spring Boot interview question list. The short answers below are my notes.',
    src: src || 'His post "Top Java and Spring Boot interview questions". Answers are mine.',
    draw: () => R(...items.map((it, i) => B(it, ['c-b', 'c-p', 'c-t', 'c-g', 'c-o'][i % 5], '', i))),
    more: hints
  });
  LESSONS.push({
    title: 'Java interview checklist', group: 'Core Java · Collections · Streams · Spring',
    steps: [
      K('Core Java, OOP and exceptions', ['JVM vs JRE', 'ClassLoader', 'ClassNotFound vs NoClassDefFound', 'String pool, intern, == vs equals', 'Checked vs unchecked', 'try-with-resources'], [
        'The JVM runs bytecode. The JRE is the JVM plus the libraries. The JDK adds the compiler and tools.',
        'ClassNotFoundException is thrown when loading a class by name fails at runtime. NoClassDefFoundError means the class existed at compile time but is missing at runtime.',
        'String literals live in the string pool. intern() returns the pooled instance. == compares references, equals compares content.',
        'Checked exceptions must be declared or caught. try-with-resources closes AutoCloseable resources in reverse order and keeps suppressed exceptions.'
      ]),
      K('Collections, Streams and functional interfaces', ['HashMap internals', 'HashMap vs Hashtable vs ConcurrentHashMap', 'map vs flatMap', 'Intermediate vs terminal ops', 'Sequential vs parallel stream', 'Functional interface'], [
        'HashMap: an array of buckets chosen by the hash. Collisions form a list that turns into a tree when long. It resizes at a 0.75 load factor. Putting the same key again replaces the value.',
        'Hashtable is fully synchronized and rejects nulls. ConcurrentHashMap locks finer-grained and uses CAS for better concurrency.',
        'map transforms each element one to one. flatMap turns each element into a stream and flattens the results.',
        'Intermediate operations are lazy and run only when a terminal operation such as collect starts the pipeline.',
        'A functional interface has exactly one abstract method. It may still have default and static methods. Runnable, Callable and Comparator are examples.'
      ]),
      K('Concurrency and design patterns', ['volatile vs Atomic', 'volatile vs synchronized', 'Future vs CompletableFuture', '5 threads printing in sequence', 'Builder', 'Singleton', 'Factory'], [
        'volatile gives visibility and ordering but not atomicity. Atomic classes use CAS for atomic updates. synchronized gives mutual exclusion plus visibility.',
        'Future.get() blocks. CompletableFuture lets you compose steps and handle errors without blocking.',
        'Sequential printing: use wait/notify, a Semaphore per thread, or a shared turn counter.',
        'Builder constructs objects with many optional fields. Factory hides which class is created. Singleton needs thread-safe initialization.'
      ]),
      K('Spring and Spring Boot', ['Auto-configuration', '@Component / @Service / @Repository / @Controller', 'Constructor injection', '@Transactional and propagation', '@Controller vs @RestController', 'RestTemplate vs WebClient', 'Actuator', '@Mock vs @InjectMocks'], [
        'Auto-configuration reads the auto-configuration list from your dependencies and applies each class only when its @Conditional rules match.',
        'All four are stereotypes. @Repository also translates persistence exceptions. @RestController is @Controller plus @ResponseBody.',
        'Constructor injection makes dependencies required, supports immutability and makes the class easy to test.',
        'Propagation REQUIRED (default) joins an existing transaction. REQUIRES_NEW suspends it and starts a new one.',
        'RestTemplate is blocking. WebClient is non-blocking and reactive. @Mock creates a fake. @InjectMocks injects the mocks into the class under test.'
      ]),
      K('Java 17 features', ['Records', 'Sealed classes', 'Pattern matching', 'Record vs POJO'], [
        'A record is a compact immutable data carrier. It cannot extend another class, but it can implement interfaces.',
        'A sealed class limits which classes may extend it. A final class allows none.',
        'Pattern matching for instanceof removes the cast: if (o instanceof String s) uses s directly.',
        'A record generates its constructor, accessors, equals, hashCode and toString. A POJO needs them written or generated.'
      ], 'An interview report he reshared. Answers are mine.')
    ]
  });

  /* ---------- New topic: Java and AI ---------- */
  LESSONS.push({
    title: 'Java in the AI era', group: 'Spring AI · LangChain4j · Vector DBs · MCP',
    steps: [{
      t: 'Java keeps up: build AI features without leaving the ecosystem',
      x: 'He points out that Java is growing in several directions at once, so you can add AI features to existing Java applications.',
      src: 'His post from the last few days, paraphrased. The one-line explanations are mine.',
      draw: () => C(
        B('Your existing Java application', 'c-m', '', 0), Dn(1),
        R(B('Spring AI', 'c-g', 'AI apps with Spring', 2), B('LangChain4j', 'c-b', 'LLMs, RAG, agents', 3), B('Vector databases', 'c-p', 'similarity search', 4), B('MCP', 'c-t', 'models talk to tools', 5), B('Virtual threads', 'c-o', 'many concurrent calls', 6))),
      more: [
        'Spring AI gives Spring-style abstractions for chat models, embeddings and vector stores.',
        'LangChain4j is a library for LLM calls, retrieval-augmented generation (RAG) and agents in Java.',
        'A vector database stores embeddings for similarity search. If you already use PostgreSQL, the pgvector extension keeps it in one database.',
        'MCP (Model Context Protocol) is an open protocol that connects models to tools and external systems.',
        'Virtual threads help when one service makes many slow, blocking calls to model APIs at once.'
      ]
    }]
  });

  // 2. rebuild the flat list and redraw
  FLAT.length = 0;
  LESSONS.forEach((l, li) => l.steps.forEach((s, si) => FLAT.push({ li, si, l, s })));
  k = 0;
  render();
})();
