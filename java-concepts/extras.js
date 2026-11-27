/* Extra material filling gaps in the core concepts (written by Claude).
   Runs after rajat.js: adds new topics (Collections, Modern Java, Design Patterns, Spring Boot internals,
   JPA and Hibernate, REST API design) and new steps inside existing topics, then rebuilds the step list. */
(function () {
  const topic = t => LESSONS.find(l => l.title === t);
  // insert a new topic before another topic (or at the end if not found)
  const addTopic = (beforeTitle, lesson) => {
    const i = LESSONS.findIndex(l => l.title === beforeTitle);
    LESSONS.splice(i < 0 ? LESSONS.length : i, 0, lesson);
  };
  // insert steps into a topic, right after the step with the given title (or at the end)
  const addAfter = (topicTitle, stepTitle, ...steps) => {
    const l = topic(topicTitle);
    if (!l) return;
    const i = stepTitle ? l.steps.findIndex(s => s.t === stepTitle) : -1;
    l.steps.splice(i < 0 ? l.steps.length : i + 1, 0, ...steps);
  };
  const push = (topicTitle, ...steps) => addAfter(topicTitle, null, ...steps);
  const T = (head, rows, cls = () => '') => `<table class="iso"><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr>` +
    rows.map((r, i) => `<tr style="--d:${i * .2}s">` + r.map((c, j) => j === 0 ? `<td><b>${c}</b></td>` : `<td class="${cls(c)}">${c}</td>`).join('') + '</tr>').join('') + '</table>';
  const yn = c => c === 'Yes' ? 'good' : c === 'No' ? 'bad' : '';

  /* ======================= JVM Internals ======================= */
  push('JVM Internals',
    {
      t: 'JIT compilation: why Java gets faster after warm-up',
      x: 'The JVM starts by interpreting bytecode. It counts how often each method runs, and hot methods are compiled to native code, first quickly by C1 and then with heavy optimization by C2.',
      draw: () => C(
        R(B('Bytecode', 'c-m', '', 0), A(0), B('Interpreter', 'c-y', 'cold code, slow', 1), A(1), B('C1 compiler', 'c-b', 'quick compile + profiling', 2), A(2), B('C2 compiler', 'c-g', 'hot code, aggressive optimization', 3)),
        R(B('Deoptimize', 'c-r', 'an assumption broke → back to interpreter', 4)),
        N('The first requests after startup are slower. That is warm-up, not a bug.')),
      more: [
        'Tiered compilation is on by default: interpreter, then C1 with profiling, then C2 for the hottest methods.',
        'Key optimizations: inlining small methods, escape analysis (objects that never leave a method can skip the heap), loop unrolling and removing dead code.',
        'If a speculative assumption breaks (for example a new subclass is loaded), the JVM deoptimizes that code and recompiles later.',
        'Benchmark with JMH, not a hand-written loop with System.nanoTime(). The JIT can remove code whose result is never used.',
        'Faster startup options: Class Data Sharing (AppCDS), the AOT cache (JDK 24+), CRaC, and GraalVM native images (Spring Boot supports these through AOT processing).'
      ],
      ex: `# See what the JIT compiles (noisy, use on a small program)
java -XX:+PrintCompilation -jar app.jar

# Typical JMH benchmark skeleton
@State(Scope.Thread)
public class ParseBench {
    String input = "12345";

    @Benchmark
    public int parse() {
        return Integer.parseInt(input);   // return the result so the JIT cannot drop it
    }
}`
    },
    {
      t: 'Diagnosing a live JVM: dumps and recordings',
      x: 'When production misbehaves, you collect evidence before restarting. A thread dump shows what every thread is doing. A heap dump shows what fills memory. JFR records everything with low overhead.',
      draw: () => C(
        B('Slow or stuck JVM', 'c-r', 'do not restart yet', 0),
        Dn(1),
        R(B('jcmd PID Thread.print', 'c-b', 'thread dump: stuck, BLOCKED, deadlock', 2), B('jcmd PID GC.heap_dump', 'c-p', 'heap dump: what fills memory', 3), B('jcmd PID JFR.start', 'c-t', 'flight recording: CPU, locks, GC, I/O', 4)),
        Dn(5),
        R(B('Eclipse MAT', 'c-m', 'leaks, dominator tree', 6), B('JDK Mission Control', 'c-m', 'open .jfr files', 7))),
      more: [
        'jcmd is the Swiss army knife: jcmd PID help lists everything it can do. jstack and jmap are older single-purpose tools.',
        'Take three thread dumps a few seconds apart. A thread stuck in the same place in all three is your suspect.',
        'A heap dump pauses the JVM and can be as large as the heap. Start production JVMs with -XX:+HeapDumpOnOutOfMemoryError so you get one automatically.',
        'JFR (Java Flight Recorder) is built into the JDK and is cheap enough to leave on in production.',
        'In Kubernetes, run these with kubectl exec inside the container, and copy the files out with kubectl cp.'
      ],
      ex: `jcmd                                 # list running JVMs and their PIDs
jcmd 4321 Thread.print > threads.txt # thread dump
jcmd 4321 GC.class_histogram | head  # which classes use the most memory
jcmd 4321 GC.heap_dump /tmp/heap.hprof
jcmd 4321 JFR.start duration=60s filename=/tmp/rec.jfr

# JVM flags worth having in production
-XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/dumps
-Xlog:gc*:file=/logs/gc.log:time,uptime:filecount=5,filesize=20m`
    }
  );

  /* ======================= Multithreading ======================= */
  push('Multithreading',
    {
      t: 'Thread lifecycle: the six states',
      x: 'A thread is NEW until start(), RUNNABLE while it runs or is ready to run, and TERMINATED when run() ends. In between it can be BLOCKED on a lock, or WAITING to be woken up.',
      draw: () => R(
        B('NEW', 'c-m', 'created', 0), A(0), B('RUNNABLE', 'c-g', 'running or ready', 1), A(1),
        C(B('BLOCKED', 'c-r', 'waiting for a monitor lock', 2), B('WAITING', 'c-y', 'wait() · join() · park()', 3), B('TIMED_WAITING', 'c-o', 'sleep(ms) · wait(ms)', 4)),
        A(4), B('TERMINATED', 'c-m', 'run() finished', 5)),
      more: [
        'These are the states you see in a thread dump. Many threads BLOCKED on the same lock means contention.',
        'BLOCKED is only for synchronized monitors. A thread waiting on a ReentrantLock shows as WAITING (parked).',
        'RUNNABLE includes threads doing blocking socket I/O, so RUNNABLE does not always mean using CPU.',
        'Calling start() twice throws IllegalThreadStateException. Calling run() directly runs the code on the current thread, not a new one.'
      ],
      ex: `Thread t = new Thread(() -> {
    try { Thread.sleep(500); } catch (InterruptedException e) {
        Thread.currentThread().interrupt();   // restore the flag, never swallow it
    }
});
System.out.println(t.getState());  // NEW
t.start();
Thread.sleep(50);
System.out.println(t.getState());  // TIMED_WAITING
t.join();
System.out.println(t.getState());  // TERMINATED`
    },
    {
      t: 'Visibility: volatile and happens-before',
      x: 'One thread writes a field and another thread may never see the new value. The Java Memory Model only guarantees visibility when there is a happens-before edge, such as a volatile write followed by a volatile read.',
      draw: () => C(
        R(C(N('Thread A'), B('running = false', 'c-b', 'plain write', 0)), C(N('Thread B'), B('while (running) { }', 'c-r', 'may loop forever', 1))),
        N('Mark the field volatile:'),
        R(B('volatile write', 'c-g', 'running = false', 2), A(2), B('happens-before', 'c-p', '', 3), A(3), B('volatile read', 'c-g', 'sees false, loop ends', 4))),
      more: [
        'Without a happens-before edge, the JIT may hoist the read out of the loop, or a core may keep using a stale value.',
        'Happens-before edges: unlocking a monitor before the next lock of it, a volatile write before a later read, Thread.start(), and Thread.join().',
        'volatile gives visibility and ordering, not atomicity. count++ on a volatile int still loses updates.',
        'Final fields set in a constructor are safely visible to other threads, as long as this does not escape during construction.'
      ],
      ex: `class Worker implements Runnable {
    private volatile boolean running = true;   // remove volatile and stop() may never work

    public void run() {
        while (running) {
            doWork();
        }
    }

    public void stop() { running = false; }
}`
    },
    {
      t: 'Atomics and CAS: thread safety without locks',
      x: 'Atomic classes use compare-and-set (CAS), a single CPU instruction: "set the value to 6 only if it is still 5". If another thread changed it first, the CAS fails and the thread simply retries.',
      draw: () => C(
        R(B('T1 reads 5', 'c-b', '', 0), A(0), B('CAS 5 → 6', 'c-g', '✓ succeeds', 1)),
        R(B('T2 reads 5', 'c-p', '', 2), A(2), B('CAS 5 → 6', 'c-r', '✗ value is now 6', 3), A(3), B('reads 6, CAS 6 → 7', 'c-g', '✓ retry succeeds', 4)),
        N('No thread ever blocks. Losers retry with the fresh value.')),
      more: [
        'AtomicInteger, AtomicLong and AtomicReference give atomic incrementAndGet, compareAndSet, updateAndGet and accumulateAndGet.',
        'Under heavy contention, many threads keep failing and retrying. LongAdder spreads the count over cells and is much faster for hot counters.',
        'The ABA problem: a value changes A → B → A and a CAS cannot tell. AtomicStampedReference adds a version stamp.',
        'ConcurrentHashMap and the java.util.concurrent queues are built on CAS.'
      ],
      ex: `AtomicInteger hits = new AtomicInteger();
hits.incrementAndGet();                       // atomic ++
hits.updateAndGet(v -> Math.min(v + 1, 100)); // atomic, with a cap

// what updateAndGet does inside:
int prev, next;
do {
    prev = hits.get();
    next = Math.min(prev + 1, 100);
} while (!hits.compareAndSet(prev, next));

LongAdder requests = new LongAdder();          // best for hot counters
requests.increment();
long total = requests.sum();`
    },
    {
      t: 'Deadlock: two threads waiting forever',
      x: 'Thread-1 holds lock A and waits for lock B. Thread-2 holds lock B and waits for lock A. Neither can continue, and nothing throws an exception.',
      draw: () => C(
        R(C(B('Thread-1', 'c-b', 'holds Lock A', 0), N('waiting for Lock B')), B('⇄', 'c-r', 'circular wait', 1), C(B('Thread-2', 'c-p', 'holds Lock B', 2), N('waiting for Lock A'))),
        N('Fix: every thread takes the locks in the same order (always A, then B), or uses tryLock with a timeout.')),
      more: [
        'All four conditions are needed: mutual exclusion, hold and wait, no preemption, and circular wait. Break any one and deadlock is impossible.',
        'The most practical fix is a global lock order, for example always lock the account with the smaller id first.',
        'ReentrantLock.tryLock(timeout) lets a thread give up, release what it holds, and retry.',
        'A thread dump prints "Found one Java-level deadlock" with both threads. ThreadMXBean.findDeadlockedThreads() detects it in code.',
        'Databases have deadlocks too. They detect them and abort one transaction, so be ready to retry.'
      ],
      ex: `// Deadlock-prone: transfer(a, b) and transfer(b, a) run at the same time
void transfer(Account from, Account to, long amt) {
    synchronized (from) {
        synchronized (to) { from.debit(amt); to.credit(amt); }
    }
}

// Fixed: always lock in id order
void transferSafe(Account from, Account to, long amt) {
    Account first  = from.id() < to.id() ? from : to;
    Account second = first == from ? to : from;
    synchronized (first) {
        synchronized (second) { from.debit(amt); to.credit(amt); }
    }
}`
    }
  );

  /* ======================= New topic: Collections Internals ======================= */
  addTopic('Database Internals', {
    title: 'Collections Internals', group: 'HashMap · equals/hashCode · ConcurrentHashMap · Lists',
    steps: [
      {
        t: 'HashMap: what put() actually does',
        x: 'The key\'s hashCode is mixed and masked to pick a bucket. An empty bucket gets a new node. In an occupied bucket, an equal key has its value replaced, and a different key is added to the chain.',
        draw: () => C(
          R(B('"apple"', 'c-m', 'key', 0), A(0), B('hashCode()', 'c-b', 'int h', 1), A(1), B('spread', 'c-b', 'h ^ (h >>> 16)', 2), A(2), B('index', 'c-p', '(n − 1) & hash = 5', 3)),
          R(cells(['0', '1', '2', '3', '4', '5', '6', '7'])),
          R(...[0, 1, 2, 3, 4, 5, 6, 7].map(i => `<div class="ptr">${i === 5 ? '▲' : ''}</div>`)),
          R(B('empty → new node', 'c-g', '', 4), B('equal key → replace value', 'c-y', '', 5), B('8+ nodes → red-black tree', 'c-t', 'when table ≥ 64', 6))),
        more: [
          'Default capacity is 16 and the load factor is 0.75, so the table doubles when it holds more than 12 entries. Resizing rehashes every entry.',
          'A bucket chain turns into a red-black tree at 8 nodes (only once the table has 64+ buckets) and back into a list at 6. Worst-case lookup becomes O(log n) instead of O(n).',
          'The table size is always a power of two, so (n − 1) &amp; hash is a cheap modulo. The spread step mixes high bits in so they affect the index.',
          'One null key is allowed and lives in bucket 0. HashMap is not thread-safe.',
          'If you know the size up front, presize it: HashMap.newHashMap(1000) (Java 19+) avoids repeated resizing.'
        ],
        ex: `Map<String, Integer> stock = new HashMap<>();
stock.put("apple", 10);   // new node in its bucket
stock.put("apple", 12);   // same key: value replaced, returns 10
stock.merge("apple", 5, Integer::sum);       // 17
stock.computeIfAbsent("kiwi", k -> 0);       // insert only if missing
stock.getOrDefault("mango", 0);              // 0, no entry created`
      },
      {
        t: 'The equals and hashCode contract',
        x: 'Hash collections find a key in two moves: hashCode picks the bucket, then equals finds the entry. If you override equals but not hashCode, two equal objects land in different buckets and the lookup fails.',
        draw: () => C(
          N('Only equals() overridden:'),
          R(B('put(new Emp(7))', 'c-b', 'goes to bucket 3', 0), B('get(new Emp(7))', 'c-p', 'looks in bucket 11', 1), B('null', 'c-r', 'entry not found', 2)),
          N('Both overridden:'),
          R(B('same id → same hash', 'c-g', '', 3), A(3), B('same bucket', 'c-g', '', 4), A(4), B('equals() → true', 'c-g', 'found', 5))),
        more: [
          'Rule: if a.equals(b) then a.hashCode() == b.hashCode(). The reverse is not required: unequal objects may share a hash (a collision).',
          'Build both from the same fields. Use fields that never change while the object is inside a HashMap or HashSet.',
          'Records generate correct equals and hashCode from their components, which makes them good map keys.',
          'JPA entities are a special case: a generated id is null before persist. Base equality on a business key, or on the id with a constant hashCode.'
        ],
        ex: `public final class Emp {
    private final int id;
    private final String name;

    @Override public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Emp e)) return false;
        return id == e.id;
    }

    @Override public int hashCode() {
        return Integer.hashCode(id);      // same field as equals
    }
}

// or simply:
public record EmpKey(int id) {}`
      },
      {
        t: 'ConcurrentHashMap: lock one bin, not the whole map',
        x: 'Hashtable and Collections.synchronizedMap use one lock, so only one thread at a time can touch the map. ConcurrentHashMap inserts into an empty bin with CAS and locks only the first node of a busy bin, so threads on different bins never wait for each other.',
        draw: () => R(
          C(N('Hashtable / synchronizedMap'), B('one lock for the whole map', 'c-r', 'T1 runs, T2 and T3 wait', 0)),
          A(1),
          C(N('ConcurrentHashMap'), R(B('bin 2', 'c-g', 'T1 locks it', 1), B('bin 5', 'c-g', 'T2 locks it', 2), B('bin 9 (empty)', 'c-t', 'T3 inserts with CAS', 3)))),
        more: [
          'Reads are almost always lock-free. Since Java 8 the map locks per bin; the old Segment design is gone.',
          'Null keys and values are rejected, because get() returning null must clearly mean "absent".',
          'Use the atomic methods: putIfAbsent, computeIfAbsent, compute and merge. A get followed by a put is a race even on a concurrent map.',
          'Iterators are weakly consistent: they never throw ConcurrentModificationException and may or may not show concurrent updates.',
          'size() is only an estimate while other threads write. mappingCount() returns a long.'
        ],
        ex: `ConcurrentHashMap<String, LongAdder> counts = new ConcurrentHashMap<>();

// Wrong: two threads can both see null and both put
if (!counts.containsKey(word)) counts.put(word, new LongAdder());

// Right: atomic per key
counts.computeIfAbsent(word, w -> new LongAdder()).increment();

// Per-key cache that loads each key only once
ConcurrentHashMap<Long, User> cache = new ConcurrentHashMap<>();
User u = cache.computeIfAbsent(id, repo::load);  // keep the function short`
      },
      {
        t: 'Choosing a collection: ArrayList, LinkedList and friends',
        x: 'ArrayList stores elements in one array, so reading by index is instant and memory is compact. LinkedList only wins at inserting where you already hold an iterator, which is rare. In practice, ArrayList and ArrayDeque cover almost every case.',
        draw: () => T(['Operation', 'ArrayList', 'LinkedList'], [
          ['get(i)', 'O(1)', 'O(n)'],
          ['add at end', 'O(1) amortized', 'O(1)'],
          ['insert / remove in the middle', 'O(n) shift', 'O(n) to find, O(1) to relink'],
          ['memory per element', 'one array slot', 'node + 2 pointers'],
          ['CPU cache friendly', 'Yes', 'No']
        ], c => c.startsWith('O(1)') || c === 'Yes' ? 'good' : c.startsWith('O(n)') || c === 'No' ? 'bad' : ''),
        more: [
          'ArrayList grows by about 1.5× when full. Presize it with new ArrayList&lt;&gt;(n) when you know n.',
          'For a queue or a stack, use ArrayDeque. It beats both LinkedList and the old synchronized Stack.',
          'TreeMap keeps keys sorted (red-black tree, O(log n)). LinkedHashMap keeps insertion order, or access order, which gives a simple LRU cache with removeEldestEntry.',
          'Iterators of ArrayList and HashMap are fail-fast: modifying the collection while looping throws ConcurrentModificationException. Use removeIf or iterator.remove().',
          'List.of and Map.of are immutable and reject nulls. CopyOnWriteArrayList suits read-heavy lists such as listeners.'
        ],
        ex: `List<Order> orders = new ArrayList<>(expectedSize);
Deque<Task> stack = new ArrayDeque<>();   // push / pop
Queue<Task> queue = new ArrayDeque<>();   // offer / poll

// LRU cache with LinkedHashMap
class Lru<K, V> extends LinkedHashMap<K, V> {
    private final int max;
    Lru(int max) { super(16, 0.75f, true); this.max = max; }  // true = access order
    @Override protected boolean removeEldestEntry(Map.Entry<K, V> e) {
        return size() > max;
    }
}`
      }
    ]
  });

  /* ======================= New topic: Modern Java ======================= */
  addTopic('Database Internals', {
    title: 'Modern Java (8 → 25)', group: 'LTS releases · Records · Sealed types · Pattern matching · Streams',
    steps: [
      {
        t: 'The LTS releases and what each one brought',
        x: 'A new Java version ships every six months, and every two years one is a long-term support (LTS) release. Most companies run an LTS. Features usually appear as previews in between and become final in a later release.',
        draw: () => R(
          B('Java 8', 'c-m', '2014 · lambdas, streams, Optional, java.time', 0), A(0),
          B('Java 11', 'c-b', '2018 · HttpClient, String helpers, java Main.java', 1), A(1),
          B('Java 17', 'c-p', '2021 · records, sealed, text blocks, switch expressions', 2), A(2),
          B('Java 21', 'c-t', '2023 · virtual threads, switch patterns, sequenced collections', 3), A(3),
          B('Java 25', 'c-g', '2025 · scoped values, compact source files, flexible constructors', 4)),
        more: [
          'Java 8: lambdas, the Stream API, Optional, default methods in interfaces and the java.time API.',
          'Java 11: the standard HttpClient, String.isBlank / strip / lines, and running a single file with java Main.java. (var for local variables arrived in Java 10.)',
          'Java 17: records, sealed classes, pattern matching for instanceof, text blocks, switch expressions and helpful NullPointerException messages. Spring Boot 3 requires Java 17 or later.',
          'Java 21: virtual threads, record patterns, pattern matching for switch, sequenced collections (getFirst, getLast, reversed) and generational ZGC.',
          'Java 25 is the latest LTS: scoped values, compact source files with instance main methods, flexible constructor bodies, module imports and compact object headers.'
        ],
        ex: `// Java 10+: var
var orders = new ArrayList<Order>();

// Java 15+: text block
String sql = """
    SELECT id, total
    FROM orders
    WHERE status = 'PAID'
    """;

// Java 14+: switch expression
int days = switch (month) {
    case FEB -> 28;
    case APR, JUN, SEP, NOV -> 30;
    default -> 31;
};

// Java 21+: sequenced collections
String last = names.getLast();`
      },
      {
        t: 'Records, sealed types and pattern matching together',
        x: 'A sealed interface lists every allowed subtype. Records give compact immutable data. A switch with patterns can then handle each case, and the compiler checks that none is missing, so there is no default branch to hide bugs.',
        draw: () => C(
          B('sealed interface Payment', 'c-p', 'permits Card, Upi, Wallet', 0),
          Dn(1),
          R(B('record Card', 'c-b', 'last4, amount', 2), B('record Upi', 'c-b', 'vpa, amount', 3), B('record Wallet', 'c-b', 'id, amount', 4)),
          Dn(5),
          B('switch (payment) { case Card c -> … }', 'c-g', 'compiler checks every case is covered', 6),
          N('Add a new subtype and every switch that misses it stops compiling.')),
        more: [
          'A record is a transparent, immutable data carrier. It generates the constructor, accessors, equals, hashCode and toString.',
          'Use a compact constructor in a record for validation.',
          'Sealed types make a closed hierarchy. Permitted subtypes must be final, sealed or non-sealed.',
          'Record patterns destructure in place: case Wallet(String id, long amt) when amt &gt; 10_000.',
          'This style is often called data-oriented programming. It fits DTOs, events and results well.'
        ],
        ex: `sealed interface Payment permits Card, Upi, Wallet {}
record Card(String last4, long amount) implements Payment {}
record Upi(String vpa, long amount) implements Payment {}
record Wallet(String id, long amount) implements Payment {
    Wallet {                                   // compact constructor
        if (amount < 0) throw new IllegalArgumentException("negative");
    }
}

long fee(Payment p) {
    return switch (p) {                        // no default: compiler checks coverage
        case Card c -> c.amount() * 2 / 100;
        case Upi u -> 0;
        case Wallet(String id, long amt) when amt > 10_000 -> 50;
        case Wallet w -> 10;
    };
}`
      },
      {
        t: 'Streams: grouping and collecting',
        x: 'Collectors turn a stream into a result. groupingBy builds a map of lists or totals, partitioningBy splits by a condition, and toMap builds a map with a merge rule for duplicate keys.',
        draw: () => C(
          R(B('Order(Ravi, 500)', 'c-m', '', 0), B('Order(Asha, 200)', 'c-m', '', 1), B('Order(Ravi, 300)', 'c-m', '', 2)),
          Dn(3),
          B('groupingBy(customer, summingLong(amount))', 'c-t', '', 3),
          Dn(4),
          R(B('Ravi → 800', 'c-g', '', 4), B('Asha → 200', 'c-g', '', 5))),
        more: [
          'groupingBy(f) gives Map&lt;K, List&lt;T&gt;&gt;. Add a downstream collector for counts, sums, averages or nested groups.',
          'partitioningBy(predicate) always returns a map with both true and false keys.',
          'toMap throws IllegalStateException on duplicate keys unless you pass a merge function.',
          'Stream.toList() (Java 16+) returns an unmodifiable list. Collectors.toList() makes no promise about that.',
          'Avoid side effects inside map or filter, and avoid parallel streams on small data or inside a web request.'
        ],
        ex: `Map<String, Long> totalByCustomer = orders.stream()
    .collect(groupingBy(Order::customer, summingLong(Order::amount)));

Map<Status, Long> countByStatus = orders.stream()
    .collect(groupingBy(Order::status, counting()));

Map<Boolean, List<Order>> bigAndSmall = orders.stream()
    .collect(partitioningBy(o -> o.amount() > 1000));

Map<Long, Order> latestById = orders.stream()
    .collect(toMap(Order::id, o -> o,
                   (a, b) -> a.createdAt().isAfter(b.createdAt()) ? a : b));

List<String> names = users.stream().map(User::name).sorted().toList();`
      }
    ]
  });

  /* ======================= New topic: Design Patterns ======================= */
  addTopic('Database Internals', {
    title: 'Design Patterns', group: 'Creational · Strategy · Observer · Structural',
    steps: [
      {
        t: 'Creational: Singleton, Builder, Factory',
        x: 'These patterns control how objects are created. Singleton gives one shared instance, Builder makes objects with many optional fields readable, and Factory hides which concrete class gets created.',
        draw: () => R(
          C(B('Singleton', 'c-b', 'one instance', 0), N('Spring beans are singletons by default')),
          C(B('Builder', 'c-p', 'step by step, then build()', 1), N('HttpRequest.newBuilder(), Lombok @Builder')),
          C(B('Factory', 'c-t', 'caller asks, factory decides the class', 2), N('List.of(), NumberFormat.getInstance()'))),
        more: [
          'Singleton: in plain Java, an enum or a static holder class is the simplest thread-safe version. In Spring, let the container manage it instead of writing a static instance.',
          'Builder: avoids constructors with many parameters of the same type, and the result can be immutable.',
          'Factory method: a static method such as of() or from() that can return a cached instance or a subtype.',
          'Abstract factory: a family of related objects, for example one factory per cloud provider.'
        ],
        ex: `// Thread-safe singleton without locks
public enum IdGenerator {
    INSTANCE;
    private final AtomicLong next = new AtomicLong();
    public long nextId() { return next.incrementAndGet(); }
}

// Builder
HttpRequest req = HttpRequest.newBuilder()
    .uri(URI.create("https://api.example.com/orders"))
    .timeout(Duration.ofSeconds(5))
    .header("Accept", "application/json")
    .GET()
    .build();`
      },
      {
        t: 'Strategy: swap the algorithm, keep the caller',
        x: 'Put each variant of an algorithm behind one interface. The caller picks a strategy at runtime instead of growing an if-else chain. Adding a new variant means adding one class.',
        draw: () => C(
          B('PaymentService', 'c-m', 'knows only the interface', 0),
          Dn(1),
          B('PaymentStrategy', 'c-p', 'pay(order)', 1),
          Dn(2),
          R(B('CardPayment', 'c-b', '', 2), B('UpiPayment', 'c-b', '', 3), B('WalletPayment', 'c-b', '', 4), B('NewPayment', 'c-g', 'just add a class', 5))),
        more: [
          'Strategy follows the open/closed principle: open for extension, closed for modification.',
          'In Spring, inject all implementations as a Map&lt;String, PaymentStrategy&gt;. The key is the bean name.',
          'Comparator is the classic JDK strategy: sort(list, byPrice) versus sort(list, byDate).',
          'Related: the State pattern looks similar, but the object switches its own state object as it changes.'
        ],
        ex: `public interface PaymentStrategy { Receipt pay(Order o); }

@Component("CARD") class CardPayment implements PaymentStrategy { ... }
@Component("UPI")  class UpiPayment  implements PaymentStrategy { ... }

@Service
class PaymentService {
    private final Map<String, PaymentStrategy> strategies;  // Spring fills this

    PaymentService(Map<String, PaymentStrategy> strategies) {
        this.strategies = strategies;
    }

    Receipt pay(Order o) {
        var s = strategies.get(o.method());   // "CARD", "UPI", ...
        if (s == null) throw new IllegalArgumentException("Unsupported: " + o.method());
        return s.pay(o);
    }
}`
      },
      {
        t: 'Observer: publish an event, let listeners react',
        x: 'The publisher announces that something happened and does not know who listens. In Spring, ApplicationEventPublisher and @EventListener give you this inside one application, the same idea Kafka gives across services.',
        draw: () => C(
          B('OrderService', 'c-m', 'publishEvent(new OrderPlaced(42))', 0),
          Dn(1),
          R(B('@EventListener', 'c-b', 'send email', 2), B('@TransactionalEventListener', 'c-p', 'after commit only', 3), B('@Async @EventListener', 'c-t', 'runs on another thread', 4))),
        more: [
          'Listeners run synchronously on the same thread by default, so a slow listener slows the publisher. Add @Async to move it off.',
          '@TransactionalEventListener(phase = AFTER_COMMIT) runs only if the transaction commits, so you never email about an order that rolled back.',
          'In-process events are lost if the app crashes. For guaranteed delivery, use the transactional outbox and a broker.',
          'JDK examples: listeners in Swing, and java.util.concurrent.Flow for reactive streams.'
        ],
        ex: `public record OrderPlaced(long orderId) {}

@Service
class OrderService {
    private final ApplicationEventPublisher events;
    OrderService(ApplicationEventPublisher events) { this.events = events; }

    @Transactional
    public void place(Order o) {
        repo.save(o);
        events.publishEvent(new OrderPlaced(o.getId()));
    }
}

@Component
class ReceiptMailer {
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    void on(OrderPlaced e) { mail.sendReceipt(e.orderId()); }
}`
      },
      {
        t: 'Structural: Decorator, Proxy, Adapter, Template Method',
        x: 'Decorator wraps an object to add behavior. Proxy wraps it to control access. Adapter makes one interface look like another. Template Method fixes the steps of an algorithm and lets you fill in one of them.',
        draw: () => R(
          C(B('Decorator', 'c-b', 'adds behavior', 0), N('new BufferedReader(new FileReader(f))')),
          C(B('Proxy', 'c-p', 'controls access', 1), N('Spring AOP: @Transactional, @Cacheable')),
          C(B('Adapter', 'c-t', 'converts an interface', 2), N('InputStreamReader: bytes → chars')),
          C(B('Template Method', 'c-o', 'fixed steps, one hook', 3), N('JdbcTemplate, RestTemplate'))),
        more: [
          'Decorator and Proxy have the same shape (both wrap and delegate). The intent differs: Decorator adds features, Proxy guards or defers access.',
          'Java I/O is built from decorators: BufferedInputStream wraps a FileInputStream, GZIPInputStream wraps that.',
          'Spring wraps your beans in proxies for transactions, caching, security and @Async. See the Spring Boot internals topic.',
          'JdbcTemplate handles connections, statements and exceptions. You only supply the SQL and a RowMapper.'
        ],
        ex: `// Decorator: each wrapper adds one capability
try (var in = new BufferedReader(
        new InputStreamReader(                  // adapter: bytes -> chars
            new GZIPInputStream(                // decorator: decompress
                new FileInputStream("log.gz")), StandardCharsets.UTF_8))) {
    in.lines().forEach(System.out::println);
}

// Template method: JdbcTemplate runs the fixed steps, you give the row mapping
List<User> users = jdbc.query("SELECT id, name FROM users",
    (rs, i) -> new User(rs.getLong("id"), rs.getString("name")));`
      }
    ]
  });

  /* ======================= Database Internals ======================= */
  addAfter('Database Internals', 'Transactions: all or nothing', {
    t: 'ACID: the four guarantees',
    x: 'A transaction promises four things. Atomicity means all or nothing. Consistency means constraints hold before and after. Isolation means concurrent transactions do not see each other\'s partial work. Durability means a commit survives a crash.',
    draw: () => R(
      C(B('Atomicity', 'c-b', 'all or nothing', 0), N('undo log / rollback')),
      C(B('Consistency', 'c-p', 'constraints always hold', 1), N('PK, FK, UNIQUE, CHECK')),
      C(B('Isolation', 'c-t', 'no partial reads', 2), N('locks or MVCC snapshots')),
      C(B('Durability', 'c-g', 'committed means saved', 3), N('write-ahead log, fsync'))),
    more: [
      'Durability comes from the write-ahead log (WAL in PostgreSQL, redo log in InnoDB): the change is written to the log before the commit returns.',
      'PostgreSQL and InnoDB use MVCC: readers see a snapshot and do not block writers.',
      'Isolation is a dial, not a switch. See the isolation levels step.',
      'Distributed NoSQL stores often relax these guarantees (BASE: basically available, soft state, eventually consistent) to scale.'
    ],
    ex: `@Transactional   // Spring: commit on success, rollback on RuntimeException
public void transfer(long from, long to, long amount) {
    accounts.debit(from, amount);
    accounts.credit(to, amount);   // throws -> debit is rolled back too
}`
  });
  push('Database Internals',
    {
      t: 'Connection pooling (HikariCP)',
      x: 'Opening a database connection costs a TCP handshake, TLS and authentication. A pool keeps a few connections open and lends them out. When all are busy, the next request waits, and after a timeout it fails.',
      draw: () => C(
        R(...[1, 2, 3, 4, 5].map((n, i) => B('req ' + n, n === 5 ? 'c-y' : 'c-m', n === 5 ? 'waits for a free one' : '', i))),
        Dn(5),
        R(B('conn 1', 'c-g', 'busy', 5), B('conn 2', 'c-g', 'busy', 6), B('conn 3', 'c-g', 'busy', 7), B('conn 4', 'c-g', 'busy', 8)),
        Dn(9),
        B('Database', 'c-b', 'max_connections is limited', 9),
        N('After connectionTimeout (30 s default) the waiting request fails with SQLTransientConnectionException.')),
      more: [
        'HikariCP is Spring Boot\'s default pool. Its default maximum pool size is 10.',
        'Bigger is not better. A small pool, close to a few times your database server\'s CPU cores, usually gives the best throughput.',
        'A transaction holds its connection until it ends. Never call slow remote APIs inside @Transactional, or the pool runs dry.',
        'Total connections = pool size × app instances. 20 pods with 10 each is 200 connections against the database limit.',
        'Turn on leakDetectionThreshold to log code that borrows a connection and does not return it.'
      ],
      ex: `# application.yml
spring:
  datasource:
    hikari:
      maximum-pool-size: 10
      minimum-idle: 10           # fixed-size pool is the Hikari recommendation
      connection-timeout: 3000   # fail fast (ms) instead of waiting 30 s
      max-lifetime: 1800000      # below the DB / proxy idle timeout
      leak-detection-threshold: 20000`
    },
    {
      t: 'Replication: primary and read replicas',
      x: 'All writes go to the primary. It streams its changes to replicas, which serve reads. Reads scale out, and a replica can be promoted if the primary fails. The catch is replication lag.',
      draw: () => C(
        R(B('App writes', 'c-m', 'INSERT / UPDATE', 0), A(0), B('Primary', 'c-p', 'source of truth', 1)),
        Dn(2),
        N('asynchronous replication (usually milliseconds, sometimes seconds)'),
        R(B('Replica 1', 'c-b', 'reads', 3), B('Replica 2', 'c-b', 'reads', 4)),
        N('A user saves a profile, then reads from a lagging replica and sees the old value.')),
      more: [
        'Read-your-own-writes: route a user\'s reads to the primary for a short time after they write, or read critical data from the primary always.',
        'Asynchronous replication can lose the latest commits if the primary dies. Synchronous replication waits for a replica and adds latency.',
        'In Spring, AbstractRoutingDataSource plus @Transactional(readOnly = true) can send read-only transactions to a replica.',
        'Replication copies all data to every node. To split data across nodes, you need sharding (System Design topic).'
      ],
      ex: `public class RoutingDataSource extends AbstractRoutingDataSource {
    @Override
    protected Object determineCurrentLookupKey() {
        return TransactionSynchronizationManager.isCurrentTransactionReadOnly()
            ? "replica" : "primary";
    }
}

@Transactional(readOnly = true)    // goes to the replica
public List<Product> search(String q) { ... }`
    }
  );

  /* ======================= New topic: Spring Boot Internals ======================= */
  addTopic('Caching', {
    title: 'Spring Boot Internals', group: 'IoC · Bean lifecycle · Scopes · Proxies · Auto-configuration',
    steps: [
      {
        t: 'IoC container and dependency injection',
        x: 'You do not create your services with new. At startup Spring scans your packages, builds a definition for each bean, creates them in dependency order and injects each one into the constructors that need it.',
        draw: () => C(
          R(B('@SpringBootApplication', 'c-m', 'main()', 0), A(0), B('Component scan', 'c-y', '@Service · @Repository · @Controller', 1), A(1), B('Bean definitions', 'c-p', 'what to create', 2)),
          Dn(3),
          R(B('UserRepository', 'c-b', 'created first', 3), A(3), B('UserService', 'c-b', 'repo injected', 4), A(4), B('UserController', 'c-g', 'service injected', 5)),
          N('Inversion of control: the container creates and wires objects, your code only declares what it needs.')),
        more: [
          'Use constructor injection. Dependencies become final, required and easy to pass in tests. One constructor needs no @Autowired.',
          'Use @Configuration with @Bean methods for classes you cannot annotate, such as a third-party client.',
          'Component scan starts at the package of the @SpringBootApplication class. Classes outside it are not found.',
          'If two beans match one type, mark one @Primary or use @Qualifier.'
        ],
        ex: `@Service
public class UserService {
    private final UserRepository repo;
    private final Clock clock;

    public UserService(UserRepository repo, Clock clock) {  // injected by Spring
        this.repo = repo;
        this.clock = clock;
    }
}

@Configuration
class AppConfig {
    @Bean Clock clock() { return Clock.systemUTC(); }       // third-party type as a bean
}`
      },
      {
        t: 'Bean lifecycle: from constructor to shutdown',
        x: 'Spring instantiates the bean, injects its dependencies, runs @PostConstruct, then lets bean post-processors wrap it. This is where proxies for @Transactional or @Async are made. On shutdown it calls @PreDestroy.',
        draw: () => R(
          B('Instantiate', 'c-m', 'constructor', 0), A(0),
          B('Inject', 'c-b', 'fields / setters', 1), A(1),
          B('@PostConstruct', 'c-p', 'init logic', 2), A(2),
          B('Post-processors', 'c-y', 'proxy created here', 3), A(3),
          B('Ready', 'c-g', 'serves requests', 4), A(4),
          B('@PreDestroy', 'c-r', 'on shutdown', 5)),
        more: [
          'BeanPostProcessor runs before and after init. AOP proxies are created in the "after" step, so other beans receive the proxy, not the raw object.',
          'Keep @PostConstruct light. Calls made there go through this, not the proxy, so @Transactional does not apply.',
          'For work after the whole app has started, listen for ApplicationReadyEvent or implement CommandLineRunner.',
          'Prototype beans are created by Spring but never destroyed by it: @PreDestroy is not called for them.'
        ],
        ex: `@Component
class PriceCache {
    @PostConstruct
    void init() { log.info("bean ready, proxies not applied to this call"); }

    @EventListener(ApplicationReadyEvent.class)
    void warmUp() { loadAllPrices(); }       // app fully started, safe to call other beans

    @PreDestroy
    void close() { log.info("context closing"); }
}`
      },
      {
        t: 'Bean scopes: who gets which instance',
        x: 'A singleton bean (the default) is created once and shared by every thread. A prototype is created each time it is requested. Web scopes give one instance per HTTP request or session.',
        draw: () => R(
          C(B('singleton', 'c-g', 'default · one per context', 0), N('shared by all request threads → keep it stateless')),
          C(B('prototype', 'c-b', 'new instance per lookup', 1), N('Spring does not destroy it')),
          C(B('request', 'c-p', 'one per HTTP request', 2), N('web apps only')),
          C(B('session', 'c-t', 'one per HTTP session', 3), N('web apps only'))),
        more: [
          'Because singletons are shared, a mutable instance field in a @Service is a race condition between requests.',
          'Injecting a prototype into a singleton gives you one prototype forever. Use ObjectProvider&lt;T&gt;.getObject(), @Lookup or a scoped proxy.',
          'Request- and session-scoped beans injected into singletons need proxyMode = ScopedProxyMode.TARGET_CLASS.',
          'Spring singletons are one per application context, not one per JVM like the classic Singleton pattern.'
        ],
        ex: `@Service
class ReportService {
    private int count;                      // BUG: shared by all threads
    private final ObjectProvider<ReportBuilder> builders;

    ReportService(ObjectProvider<ReportBuilder> builders) { this.builders = builders; }

    Report build() {
        ReportBuilder b = builders.getObject();   // fresh prototype each call
        return b.build();
    }
}

@Component
@Scope("prototype")
class ReportBuilder { ... }`
      },
      {
        t: 'Proxies: how @Transactional, @Async and @Cacheable work',
        x: 'Spring wraps the bean in a proxy. A call from another bean goes through the proxy, which starts the transaction, calls your method, then commits or rolls back. A call from inside the same class uses this and skips the proxy.',
        draw: () => C(
          R(B('OrderController', 'c-m', '', 0), A(0), B('Proxy', 'c-y', 'begin transaction', 1), A(1), B('OrderService.place()', 'c-g', 'your code', 2), A(2), B('Proxy', 'c-y', 'commit / rollback', 3)),
          N('Self-invocation:'),
          R(B('place()', 'c-g', 'inside OrderService', 4), A(4), B('this.audit()', 'c-r', '@Transactional(REQUIRES_NEW) ignored', 5))),
        more: [
          'Spring Boot uses CGLIB subclass proxies by default. Final classes and final or private methods cannot be intercepted.',
          'Same rule for @Async, @Cacheable, @Retryable and @PreAuthorize: they only work when called through the proxy.',
          'Fixes for self-invocation: move the method into another bean (best), or use TransactionTemplate for programmatic transactions.',
          'By default, rollback happens only for RuntimeException and Error. Use rollbackFor = Exception.class for checked exceptions.',
          '@Transactional(readOnly = true) lets Hibernate skip dirty checking and can route to a replica.'
        ],
        ex: `@Service
class OrderService {
    private final AuditService audit;   // separate bean -> goes through its proxy

    @Transactional
    public void place(Order o) {
        repo.save(o);
        audit.record(o);                // REQUIRES_NEW really applies
        // this.recordLocally(o);       // would bypass the proxy
    }
}

@Service
class AuditService {
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(Order o) { ... }  // commits even if place() rolls back
}`
      },
      {
        t: 'Auto-configuration: how Boot configures itself',
        x: 'Each starter brings auto-configuration classes. Boot evaluates their conditions, such as "is this class on the classpath?" and "has the user already defined this bean?", and only creates the beans whose conditions pass. Your own beans always win.',
        draw: () => C(
          R(B('spring-boot-starter-data-jpa', 'c-m', 'on the classpath', 0), A(0), B('AutoConfiguration.imports', 'c-p', 'lists DataSourceAutoConfiguration', 1)),
          Dn(2),
          R(B('@ConditionalOnClass(DataSource)', 'c-g', '✓', 2), B('@ConditionalOnMissingBean', 'c-g', '✓ you did not define one', 3), B('spring.datasource.url set', 'c-g', '✓', 4)),
          Dn(5),
          B('HikariDataSource bean created', 'c-b', 'from your properties', 5)),
        more: [
          'The list lives in META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports (spring.factories in old Boot 2.x).',
          'Start with --debug (or debug=true) to print the condition evaluation report: which auto-configurations matched and why.',
          'Actuator\'s /actuator/conditions endpoint shows the same report at runtime.',
          'Exclude one with @SpringBootApplication(exclude = DataSourceAutoConfiguration.class).',
          'Property precedence, highest first: command-line args, environment variables, application-{profile}.yml, application.yml.'
        ],
        ex: `// Writing your own auto-configuration
@AutoConfiguration
@ConditionalOnClass(SmsClient.class)
@EnableConfigurationProperties(SmsProperties.class)
public class SmsAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean                  // user's own SmsClient bean wins
    SmsClient smsClient(SmsProperties props) {
        return new SmsClient(props.apiKey(), props.timeout());
    }
}

// register it in:
// META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports
// com.example.sms.SmsAutoConfiguration`
      }
    ]
  });

  /* ======================= New topic: JPA and Hibernate ======================= */
  addTopic('Caching', {
    title: 'JPA & Hibernate', group: 'Persistence context · N+1 · Fetch types · Locking',
    steps: [
      {
        t: 'Entity states and the persistence context',
        x: 'Inside a transaction, Hibernate keeps every loaded entity in the persistence context. Change a managed entity and Hibernate writes an UPDATE at commit, with no save() call needed. This is called dirty checking.',
        draw: () => C(
          R(B('new Order()', 'c-m', 'Transient: unknown to JPA', 0), A(0), B('persist()', 'c-b', '', 1), A(1), B('Managed', 'c-g', 'tracked, changes auto-saved', 2), A(2), B('commit / flush', 'c-p', 'SQL sent', 3)),
          R(B('Detached', 'c-y', 'transaction ended', 4), A(4), B('merge()', 'c-b', 'copy back in', 5), A(5), B('Managed', 'c-g', '', 6), B('remove()', 'c-r', 'Removed → DELETE at flush', 7))),
        more: [
          'The persistence context is also a first-level cache: find(Order.class, 42) twice in one transaction runs one SELECT.',
          'Flush sends pending SQL. It happens at commit and, by default, before a query that might read the changed tables.',
          'Spring Data save() calls persist for a new entity and merge for a detached one. Inside a transaction, a managed entity does not need save() at all.',
          'Loading thousands of entities in one transaction makes dirty checking slow. Use read-only transactions, projections or batch processing with clear().'
        ],
        ex: `@Transactional
public void rename(long id, String name) {
    Customer c = repo.findById(id).orElseThrow();  // managed
    c.setName(name);                               // no save() needed
}   // commit -> dirty check -> UPDATE customer SET name=? WHERE id=?

@Transactional(readOnly = true)                    // skips dirty checking
public CustomerView view(long id) { ... }`
      },
      {
        t: 'The N+1 query problem',
        x: 'One query loads a list of orders. Then, inside a loop, each order lazily loads its customer with its own query. 100 orders means 101 queries. A fetch join loads everything in one query.',
        draw: () => C(
          N('Lazy loading in a loop:'),
          R(B('SELECT orders', 'c-b', '1 query, 3 rows', 0), A(0), B('SELECT customer #1', 'c-r', '', 1), B('SELECT customer #2', 'c-r', '', 2), B('SELECT customer #3', 'c-r', '', 3)),
          N('With JOIN FETCH or @EntityGraph:'),
          R(B('SELECT o, c FROM orders JOIN customers', 'c-g', '1 query total', 4))),
        more: [
          'It hides in loops, in toString(), in JSON serialization of entities and in mapping entities to DTOs.',
          'Switching to EAGER does not fix it. findAll() with EAGER still loads the associations one by one.',
          'Fixes: JOIN FETCH in JPQL, @EntityGraph on the repository method, hibernate.default_batch_fetch_size (loads in batches with IN), or a DTO projection.',
          'Fetch-joining a collection together with pagination makes Hibernate paginate in memory and log a warning. Page the ids first, then fetch.',
          'Detect it: log SQL in development, enable Hibernate statistics, or assert query counts in tests.'
        ],
        ex: `// N+1
List<Order> orders = orderRepo.findAll();
orders.forEach(o -> System.out.println(o.getCustomer().getName()));  // 1 query per order

// Fix 1: fetch join
@Query("select o from Order o join fetch o.customer where o.status = :s")
List<Order> findWithCustomer(@Param("s") Status s);

// Fix 2: entity graph
@EntityGraph(attributePaths = "customer")
List<Order> findByStatus(Status s);

// Fix 3 (global): batch lazy loads with IN (...)
spring.jpa.properties.hibernate.default_batch_fetch_size=50`
      },
      {
        t: 'Fetch types: LAZY vs EAGER',
        x: 'LAZY returns a proxy and loads the association only when you touch it. EAGER always loads it. The JPA defaults are EAGER for to-one and LAZY for to-many relations. Make them all LAZY and fetch explicitly per use case.',
        draw: () => C(
          T(['Mapping', 'JPA default', 'Recommended'], [
            ['@ManyToOne', 'EAGER', 'LAZY'],
            ['@OneToOne', 'EAGER', 'LAZY'],
            ['@OneToMany', 'LAZY', 'LAZY'],
            ['@ManyToMany', 'LAZY', 'LAZY']
          ], c => c === 'EAGER' ? 'bad' : 'good'),
          N('Touching a lazy field after the session closed → LazyInitializationException.')),
        more: [
          'EAGER on to-one relations quietly loads extra tables on every query, even when you never use them.',
          'LazyInitializationException means the transaction ended before the lazy field was read. Load what you need inside the transaction.',
          'Spring Boot enables open-in-view by default and logs a warning about it. It keeps the session open during view rendering, which hides the problem and holds connections longer. Set spring.jpa.open-in-view=false.',
          'For read endpoints, a DTO or interface projection loads only the columns you need.'
        ],
        ex: `@Entity
class Order {
    @ManyToOne(fetch = FetchType.LAZY)        // override the EAGER default
    private Customer customer;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<OrderLine> lines = new ArrayList<>();
}

// Projection: only the columns you need, no entity, no lazy traps
record OrderSummary(Long id, String customerName, BigDecimal total) {}

@Query("select new com.shop.OrderSummary(o.id, c.name, o.total) " +
       "from Order o join o.customer c")
List<OrderSummary> summaries();

// application.yml
spring.jpa.open-in-view: false`
      },
      {
        t: 'Optimistic vs pessimistic locking',
        x: 'Optimistic locking adds a version column. An UPDATE succeeds only if the version is unchanged, otherwise it fails and you retry. Pessimistic locking takes a row lock with SELECT ... FOR UPDATE, so the second transaction waits.',
        draw: () => C(
          N('Optimistic (@Version): both read version 1'),
          R(B('Tx A: UPDATE … WHERE version = 1', 'c-g', '1 row → version 2', 0), B('Tx B: UPDATE … WHERE version = 1', 'c-r', '0 rows → OptimisticLockException', 1)),
          N('Pessimistic (FOR UPDATE):'),
          R(B('Tx A locks the row', 'c-p', 'updates, commits', 2), A(2), B('Tx B was waiting', 'c-y', 'now reads the new value', 3))),
        more: [
          'Optimistic suits low contention: no locks are held, and conflicts are rare and retried. Most web apps should start here.',
          'Pessimistic suits high contention on the same rows, such as stock counters or seat booking, with short transactions.',
          'Pessimistic locks can deadlock and time out. Always lock rows in a consistent order and set a lock timeout.',
          'For a simple counter, an atomic UPDATE ... SET stock = stock - 1 WHERE id = ? AND stock &gt; 0 needs neither.'
        ],
        ex: `@Entity
class Product {
    @Id Long id;
    int stock;
    @Version long version;          // optimistic locking, managed by Hibernate
}

// Pessimistic
interface ProductRepo extends JpaRepository<Product, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)          // SELECT ... FOR UPDATE
    @Query("select p from Product p where p.id = :id")
    Optional<Product> findForUpdate(@Param("id") Long id);

    @Modifying
    @Query("update Product p set p.stock = p.stock - 1 where p.id = :id and p.stock > 0")
    int decrementIfAvailable(@Param("id") Long id);   // 0 = sold out
}`
      }
    ]
  });

  /* ======================= New topic: REST API Design ======================= */
  addTopic('Caching', {
    title: 'REST API Design', group: 'Spring MVC flow · HTTP methods · Status codes · Pagination',
    steps: [
      {
        t: 'A request through Spring MVC',
        x: 'Every request enters the DispatcherServlet. It finds the matching controller method, binds and validates the input, calls your code, and Jackson turns the return value into JSON. Exceptions go to one global handler.',
        draw: () => C(
          R(B('HTTP request', 'c-m', '', 0), A(0), B('Security filters', 'c-r', 'auth', 1), A(1), B('DispatcherServlet', 'c-p', 'front controller', 2), A(2), B('HandlerMapping', 'c-b', 'finds @GetMapping', 3)),
          Dn(4),
          R(B('Bind + @Valid', 'c-y', '400 if invalid', 4), A(4), B('Controller → Service', 'c-g', 'your code', 5), A(5), B('Jackson', 'c-t', 'object → JSON', 6)),
          N('Any exception → @RestControllerAdvice → one consistent error body.')),
        more: [
          'Keep controllers thin: map HTTP to a service call and back. Business rules live in services.',
          'Accept and return DTOs, not JPA entities. Entities leak internal fields and trigger lazy loading during serialization.',
          'Use Bean Validation (@NotBlank, @Email, @Size) on request DTOs with @Valid. Failures become 400 responses.',
          'Spring supports RFC 9457 Problem Details: return ProblemDetail, or set spring.mvc.problemdetails.enabled=true.'
        ],
        ex: `record CreateUser(@NotBlank String name, @Email String email) {}

@RestController
@RequestMapping("/api/users")
class UserController {
    @PostMapping
    ResponseEntity<UserDto> create(@Valid @RequestBody CreateUser req) {
        UserDto u = service.create(req);
        return ResponseEntity.created(URI.create("/api/users/" + u.id())).body(u);
    }
}

@RestControllerAdvice
class Errors {
    @ExceptionHandler(UserNotFound.class)
    ProblemDetail notFound(UserNotFound e) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, e.getMessage());
    }
}`
      },
      {
        t: 'HTTP methods: safe and idempotent',
        x: 'A safe method does not change state. An idempotent method leaves the same state whether it runs once or ten times, so clients and proxies can retry it. POST is neither, which is why payments need an idempotency key.',
        draw: () => T(['Method', 'Use', 'Safe', 'Idempotent'], [
          ['GET', 'read a resource', 'Yes', 'Yes'],
          ['POST', 'create / run an action', 'No', 'No'],
          ['PUT', 'replace a whole resource', 'No', 'Yes'],
          ['PATCH', 'change some fields', 'No', 'Not guaranteed'],
          ['DELETE', 'remove a resource', 'No', 'Yes']
        ], yn),
        more: [
          'Idempotent is about server state, not the response: a second DELETE may return 404, but the resource is still gone.',
          'PATCH such as "set status = PAID" is idempotent. PATCH such as "add 10 to balance" is not.',
          'Make POST safe to retry with an Idempotency-Key header stored under a unique constraint, returning the saved response on a repeat.',
          'Use nouns for resources and HTTP methods for actions: POST /orders, not POST /createOrder.'
        ],
        ex: `GET    /api/orders?status=PAID      200 list
GET    /api/orders/42               200 one order, 404 if missing
POST   /api/orders                  201 + Location: /api/orders/43
PUT    /api/orders/42               200 replaced
PATCH  /api/orders/42               200 { "status": "CANCELLED" }
DELETE /api/orders/42               204 no content

POST /api/payments
Idempotency-Key: 7f9c2a1e-…          # same key again -> same response, charged once`
      },
      {
        t: 'Status codes that matter',
        x: 'The status code tells the client what to do next without parsing the body. 2xx means success, 4xx means the client must change the request, and 5xx means the server failed and a retry might help.',
        draw: () => C(
          R(B('200 OK', 'c-g', '', 0), B('201 Created', 'c-g', '+ Location header', 1), B('204 No Content', 'c-g', '', 2)),
          R(B('400 Bad Request', 'c-y', 'invalid input', 3), B('401 Unauthorized', 'c-y', 'not logged in', 4), B('403 Forbidden', 'c-y', 'logged in, not allowed', 5), B('404 Not Found', 'c-y', '', 6), B('409 Conflict', 'c-y', 'duplicate or version clash', 7), B('429 Too Many', 'c-y', 'rate limited', 8)),
          R(B('500 Internal', 'c-r', 'bug', 9), B('502 Bad Gateway', 'c-r', 'upstream failed', 10), B('503 Unavailable', 'c-r', 'overloaded / down', 11), B('504 Timeout', 'c-r', 'upstream too slow', 12))),
        more: [
          '401 means "who are you?" (missing or bad credentials). 403 means "I know you, but no".',
          'Return 409 for an optimistic-lock conflict or a duplicate unique key, so the client knows to reload and retry.',
          'Retry only 429, 502, 503 and 504 (and idempotent requests), with backoff. Never blindly retry 4xx.',
          'Never return 200 with an error inside the body. Monitoring and clients rely on the code.'
        ],
        ex: `// A consistent error body (RFC 9457 Problem Details)
HTTP/1.1 409 Conflict
Content-Type: application/problem+json

{
  "type": "https://api.example.com/errors/version-conflict",
  "title": "Version conflict",
  "status": 409,
  "detail": "Order 42 was changed by someone else. Reload and try again.",
  "instance": "/api/orders/42"
}`
      },
      {
        t: 'Pagination: offset vs keyset',
        x: 'OFFSET 100000 LIMIT 20 makes the database read and discard 100,000 rows, so deep pages get slower. Keyset pagination remembers the last id seen and asks for rows after it, which is one index seek at any depth.',
        draw: () => R(
          C(B('Offset', 'c-r', 'LIMIT 20 OFFSET 100000', 0), N('reads 100,020 rows, keeps 20'), N('rows shift if data changes → skips / duplicates')),
          A(1),
          C(B('Keyset (cursor)', 'c-g', 'WHERE id > :lastId ORDER BY id LIMIT 20', 2), N('index seek, reads 20 rows'), N('stable while data changes'))),
        more: [
          'Offset is fine for admin screens and small tables, and it allows "jump to page 50".',
          'Keyset fits infinite scroll, feeds and exports. It cannot jump to an arbitrary page.',
          'Keyset needs a unique, indexed sort key. For sorting by date, use (created_at, id) so ties are broken.',
          'Spring Data Pageable is offset-based. Spring Data 3.1+ adds keyset scrolling with Window and ScrollPosition.',
          'Return a next cursor in the response and avoid COUNT(*) on huge tables unless the UI really needs a total.'
        ],
        ex: `-- Offset: slow for deep pages
SELECT * FROM orders ORDER BY id LIMIT 20 OFFSET 100000;

-- Keyset: fast at any depth
SELECT * FROM orders WHERE id > :lastSeenId ORDER BY id LIMIT 20;

// Spring Data keyset scrolling
Window<Order> page = repo.findFirst20ByOrderByIdAsc(ScrollPosition.keyset());
Window<Order> next = repo.findFirst20ByOrderByIdAsc(page.positionAt(page.size() - 1));

// response
{ "items": [ ... ], "nextCursor": "eyJpZCI6MTAwMjB9" }`
      }
    ]
  });

  /* ======================= Messaging (Kafka) ======================= */
  addAfter('Messaging (Kafka)', 'Offsets: where am I in the log?',
    {
      t: 'Delivery semantics: at most, at least, exactly once',
      x: 'When you commit the offset decides what a crash costs you. Commit before processing and a crash loses the message. Process before committing and a crash repeats it. Exactly-once needs Kafka transactions.',
      draw: () => C(
        R(B('At most once', 'c-r', 'commit → process', 0), N('crash → message lost')),
        R(B('At least once', 'c-y', 'process → commit', 1), N('crash → message repeated (the usual choice)')),
        R(B('Exactly once', 'c-g', 'idempotent producer + transactions', 2), N('only for Kafka → Kafka pipelines')),
        N('Side effects outside Kafka (DB writes, emails, payments) still need an idempotent consumer.')),
      more: [
        'Most systems choose at-least-once and make the consumer idempotent: store processed event ids, or use upserts.',
        'Durable producer: acks=all, enable.idempotence=true (both default since Kafka 3.0), a replication factor of 3 and min.insync.replicas=2.',
        'Exactly-once uses a transactional producer that writes the output and the consumer offset in one transaction. Readers set isolation.level=read_committed.',
        'Spring Kafka commits after the listener returns successfully by default, which gives at-least-once.'
      ],
      ex: `// Idempotent consumer: the second delivery is a no-op
@KafkaListener(topics = "payments")
@Transactional
public void on(PaymentEvent e) {
    if (processedRepo.existsById(e.eventId())) return;   // already handled
    ledger.apply(e);
    processedRepo.save(new Processed(e.eventId()));      // same DB transaction
}

# producer
acks=all
enable.idempotence=true
# topic
replication.factor=3
min.insync.replicas=2`
    },
    {
      t: 'Retries and dead letter topics',
      x: 'Some messages fail every time, such as bad data. Retrying them forever blocks the partition. Retry a few times with backoff, then move the message to a dead letter topic, alert, and keep the partition moving.',
      draw: () => R(
        B('orders', 'c-b', 'topic', 0), A(0),
        B('Consumer', 'c-m', 'throws', 1), A(1),
        B('Retry 1s · 2s · 4s', 'c-y', 'backoff', 2), A(2),
        B('orders-dlt', 'c-r', 'dead letter topic', 3), A(3),
        B('Alert · inspect · replay', 'c-g', 'after the fix', 4)),
      more: [
        'Separate transient errors (timeouts, a down service: retry) from permanent ones (bad JSON, validation: send straight to the DLT).',
        'Blocking retries keep order but stall the partition. Non-blocking retry topics keep the partition moving but can reorder messages.',
        'In Spring Kafka, DefaultErrorHandler with DeadLetterPublishingRecoverer does blocking retries, and @RetryableTopic sets up retry topics plus a DLT.',
        'Keep the original headers (exception, topic, offset) on the DLT record so you can debug and replay.'
      ],
      ex: `@Bean
DefaultErrorHandler errorHandler(KafkaTemplate<Object, Object> template) {
    var recoverer = new DeadLetterPublishingRecoverer(template);   // -> orders-dlt
    var handler = new DefaultErrorHandler(recoverer, new ExponentialBackOff(1000, 2));
    handler.addNotRetryableExceptions(JsonParseException.class, ValidationException.class);
    return handler;
}

// or non-blocking retry topics
@RetryableTopic(attempts = "4", backoff = @Backoff(delay = 1000, multiplier = 2))
@KafkaListener(topics = "orders")
void on(OrderEvent e) { ... }`
    }
  );

  /* ======================= Microservices ======================= */
  addAfter('Microservices', 'Service discovery: find instances by name', {
    t: 'Synchronous vs asynchronous communication',
    x: 'With REST or gRPC the caller waits for an answer, so if the callee is slow or down, the caller suffers too. With messaging the caller publishes and moves on, and the consumer processes when it can.',
    draw: () => R(
      C(N('Synchronous (REST / gRPC)'), R(B('Order', 'c-b', '', 0), A(0), B('Payment', 'c-b', 'must be up now', 1)), N('simple, immediate answer, but temporal coupling')),
      C(N('Asynchronous (Kafka / RabbitMQ)'), R(B('Order', 'c-g', '', 2), A(2), B('broker', 'c-y', '', 3), A(3), B('Payment', 'c-g', 'processes later', 4)), N('resilient to outages, but eventual consistency'))),
    more: [
      'Use synchronous calls when the user needs the answer now, such as checking a price or validating a coupon.',
      'Use events when other services only need to react, such as sending emails or updating search indexes.',
      'Long chains of synchronous calls multiply latency and failure: five services at 99.9% each give about 99.5% overall.',
      'Every synchronous call needs a timeout. The default in many HTTP clients is to wait forever.'
    ],
    ex: `// Synchronous with a timeout (Spring 6.1+ RestClient)
var factory = new JdkClientHttpRequestFactory(
    HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(1)).build());
factory.setReadTimeout(Duration.ofSeconds(2));

RestClient client = RestClient.builder()
    .baseUrl("http://payment-svc")
    .requestFactory(factory)
    .build();

// Asynchronous
kafka.send("order-placed", order.id().toString(), new OrderPlaced(order.id()));`
  });

  /* ======================= Security ======================= */
  push('Security',
    {
      t: 'Password storage: hash slowly, never encrypt',
      x: 'Store a slow, salted hash, never the password or a reversible encryption of it. At login, hash the attempt with the same salt and compare. A random salt per user means equal passwords give different hashes.',
      draw: () => C(
        R(B('"secret123"', 'c-m', 'password', 0), A(0), B('+ random salt', 'c-y', 'unique per user', 1), A(1), B('BCrypt (cost 10)', 'c-p', 'deliberately slow', 2), A(2), B('$2a$10$N9qo8uLO…', 'c-g', 'stored in DB', 3)),
        N('Login: BCrypt(attempt, stored salt) == stored hash? The salt and cost are kept inside the hash string.')),
      more: [
        'Use BCrypt, Argon2 or PBKDF2. Never use MD5 or SHA-256 alone for passwords: they are fast, so attackers can try billions of guesses per second.',
        'The cost factor makes each hash take tens of milliseconds, cheap for one login and expensive for an attacker.',
        'Spring Security\'s DelegatingPasswordEncoder stores the algorithm as a prefix ({bcrypt}…), so you can upgrade algorithms later.',
        'Encryption is reversible, so anyone with the key can read every password. Hashing is one-way.'
      ],
      ex: `@Bean
PasswordEncoder passwordEncoder() {
    return PasswordEncoderFactories.createDelegatingPasswordEncoder();  // {bcrypt} by default
}

String hash = encoder.encode("secret123");      // {bcrypt}$2a$10$...
boolean ok  = encoder.matches("secret123", hash); // true`
    },
    {
      t: 'CORS and CSRF: two different browser problems',
      x: 'CORS controls whether a page from another origin may read your API\'s responses. The browser enforces it based on headers your server sends. CSRF is an attack where another site makes the user\'s browser send a request with their cookies.',
      draw: () => R(
        C(B('CORS', 'c-b', 'can app.example.com read api.example.com?', 0), N('server answers with Access-Control-Allow-Origin'), N('preflight OPTIONS for non-simple requests')),
        C(B('CSRF', 'c-r', 'evil.com submits a form to your bank', 1), N('browser attaches the session cookie automatically'), N('defense: CSRF token, SameSite cookies'))),
      more: [
        'CORS is not a security wall for your server. It protects users\' browsers. curl and Postman ignore it.',
        'Allow specific origins in production. allowedOrigins("*") cannot be combined with credentials.',
        'CSRF matters when authentication rides on cookies. A stateless API that reads a JWT from the Authorization header is usually safe, so CSRF protection is often disabled there.',
        'Spring Security enables CSRF protection by default. Disable it only when you understand why it does not apply.'
      ],
      ex: `@Bean
SecurityFilterChain api(HttpSecurity http) throws Exception {
    return http
        .cors(Customizer.withDefaults())
        .csrf(csrf -> csrf.disable())   // OK only for stateless, header-based JWT
        .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .build();
}

@Bean
CorsConfigurationSource cors() {
    var c = new CorsConfiguration();
    c.setAllowedOrigins(List.of("https://app.example.com"));
    c.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE"));
    c.setAllowedHeaders(List.of("Authorization", "Content-Type"));
    var src = new UrlBasedCorsConfigurationSource();
    src.registerCorsConfiguration("/api/**", c);
    return src;
}`
    }
  );

  /* ======================= System Design ======================= */
  push('System Design',
    {
      t: 'CAP theorem: consistency or availability during a partition',
      x: 'When the network splits two nodes apart, a distributed system must choose. It can refuse requests to stay consistent (CP), or keep answering and accept that nodes may disagree for a while (AP).',
      draw: () => C(
        R(B('Node A', 'c-b', 'balance = 100', 0), B('✂ network partition', 'c-r', '', 1), B('Node B', 'c-b', 'balance = 100', 2)),
        Dn(3),
        R(C(B('CP', 'c-p', 'reject writes on the minority side', 3), N('correct but partly unavailable')), C(B('AP', 'c-g', 'accept writes on both sides', 4), N('available, reconcile later'))),
        N('Partitions will happen in a distributed system, so the real choice is between C and A while one lasts.')),
      more: [
        'CP examples: ZooKeeper, etcd and a single-primary relational database.',
        'AP-leaning examples: Cassandra and DynamoDB, which let you tune consistency per request.',
        'PACELC extends CAP: even without a partition, you trade latency against consistency.',
        'Pick per feature, not per company: a bank balance needs CP, a like counter can be AP.'
      ],
      ex: `Feature                 Choice   Why
Payment / balance       CP       a wrong answer costs money
Seat or stock booking   CP       must not oversell
Like / view counter     AP       slightly stale is fine
Product catalog read    AP       availability matters more`
    },
    {
      t: 'Consistent hashing: add a node, move few keys',
      x: 'With hash(key) % N, changing N from 3 to 4 moves most keys. Consistent hashing places nodes and keys on a ring, and each key belongs to the next node clockwise. Adding a node only takes keys from its neighbor.',
      draw: () => C(
        N('Ring positions 0–359, each key goes to the next node clockwise'),
        R(B('Node A', 'c-b', 'owns 0–90', 0), B('Node B', 'c-b', 'owns 91–200', 1), B('Node C', 'c-b', 'owns 201–359', 2)),
        Dn(3),
        N('Add Node D at 280:'),
        R(B('Node A', 'c-m', 'unchanged', 3), B('Node B', 'c-m', 'unchanged', 4), B('Node C', 'c-y', 'now 201–280', 5), B('Node D', 'c-g', 'takes 281–359', 6))),
      more: [
        'With modulo hashing, going from N to N+1 nodes remaps about N/(N+1) of all keys, which empties caches.',
        'With consistent hashing, only about 1/(N+1) of the keys move.',
        'Virtual nodes give each server many points on the ring, which spreads load evenly and shares the moved keys among all nodes.',
        'Used by Cassandra, DynamoDB and many cache clients. Redis Cluster uses a related idea: 16,384 fixed hash slots assigned to nodes.'
      ],
      ex: `class ConsistentHash<T> {
    private final TreeMap<Integer, T> ring = new TreeMap<>();
    private final int virtualNodes = 100;

    void add(T node) {
        for (int i = 0; i < virtualNodes; i++)
            ring.put(hash(node + "#" + i), node);
    }

    T nodeFor(String key) {
        var e = ring.ceilingEntry(hash(key));          // next node clockwise
        return (e != null ? e : ring.firstEntry()).getValue();  // wrap around
    }
}`
    }
  );

  /* ======================= DevOps ======================= */
  push('DevOps',
    {
      t: 'Kubernetes probes: liveness vs readiness',
      x: 'Kubernetes asks your pod two questions. Liveness asks "are you stuck?" and a failure restarts the container. Readiness asks "can you take traffic right now?" and a failure only removes the pod from the Service.',
      draw: () => R(
        C(B('startupProbe', 'c-y', 'has the app finished booting?', 0), N('protects slow starts from liveness kills')),
        C(B('livenessProbe', 'c-r', 'is the process stuck?', 1), N('fails → container restarted')),
        C(B('readinessProbe', 'c-g', 'can it serve traffic now?', 2), N('fails → no traffic, no restart'))),
      more: [
        'Spring Boot Actuator exposes /actuator/health/liveness and /actuator/health/readiness when running on Kubernetes.',
        'Do not check the database in liveness. A database outage would restart every pod and make things worse. Readiness may check it.',
        'Enable graceful shutdown (server.shutdown=graceful) so in-flight requests finish when a pod is stopped.',
        'Set CPU and memory requests and limits. Use -XX:MaxRAMPercentage so the heap fits inside the container limit.'
      ],
      ex: `livenessProbe:
  httpGet: { path: /actuator/health/liveness, port: 8080 }
  periodSeconds: 10
readinessProbe:
  httpGet: { path: /actuator/health/readiness, port: 8080 }
  periodSeconds: 5
startupProbe:
  httpGet: { path: /actuator/health/liveness, port: 8080 }
  failureThreshold: 30
  periodSeconds: 2          # up to 60 s to boot
env:
  - name: JAVA_TOOL_OPTIONS
    value: "-XX:MaxRAMPercentage=75"`
    },
    {
      t: 'Blue-green and canary releases',
      x: 'Blue-green runs the new version beside the old one and switches all traffic at once, with an instant switch back. Canary sends a small share of traffic to the new version first and grows it while the metrics stay healthy.',
      draw: () => C(
        N('Blue-green'),
        R(B('Blue v1', 'c-b', '100% traffic', 0), A(0), B('Switch router', 'c-p', 'one step', 1), A(1), B('Green v2', 'c-g', '100% traffic', 2)),
        N('Canary'),
        R(B('v2 gets 5%', 'c-y', '', 3), A(3), B('errors and latency OK?', 'c-p', '', 4), A(4), B('25% → 50% → 100%', 'c-g', '', 5))),
      more: [
        'Rolling update (earlier step): replace pods gradually. It is the simplest option and the Kubernetes default.',
        'Blue-green: needs double capacity during the switch, and rollback is instant.',
        'Canary: limits the blast radius of a bad release. Tools such as Argo Rollouts or a service mesh automate the steps.',
        'All of them need backward-compatible database migrations, because old and new versions run at the same time.'
      ],
      ex: `Safe column rename across versions (expand / contract):
1. v2: add new column, write to both old and new      (old v1 still works)
2. backfill the new column in batches
3. v3: read from the new column only
4. v4: drop the old column`
    }
  );

  /* ======================= Observability ======================= */
  push('Observability', {
    t: 'Percentiles, not averages',
    x: 'An average hides the slow requests. If p99 is 2 seconds, one user in a hundred waits 2 seconds or more, even when the average looks fine. Alert on percentiles and on error rate.',
    draw: () => C(
      R(B('average', 'c-g', '120 ms · looks fine', 0), B('p50', 'c-g', '80 ms', 1), B('p95', 'c-y', '300 ms', 2), B('p99', 'c-r', '2.1 s · 1 in 100 users', 3)),
      N('RED for services: Rate, Errors, Duration. USE for resources: Utilization, Saturation, Errors.')),
    more: [
      'The four golden signals: latency, traffic, errors and saturation.',
      'Spring Boot uses Micrometer for metrics. Add micrometer-registry-prometheus and scrape /actuator/prometheus.',
      'Percentiles from different instances cannot be averaged. Publish histograms and let Prometheus compute percentiles across them.',
      'Micrometer Tracing (with OpenTelemetry) replaced Spring Cloud Sleuth in Spring Boot 3, and puts traceId into logs automatically.'
    ],
    ex: `# application.yml
management:
  endpoints.web.exposure.include: health,info,prometheus
  metrics.distribution.percentiles-histogram.http.server.requests: true

# PromQL: p99 latency per endpoint over 5 minutes
histogram_quantile(0.99,
  sum by (le, uri) (rate(http_server_requests_seconds_bucket[5m])))

// Custom timer
@Timed(value = "orders.place", histogram = true)
public Order place(...) { ... }`
  });

  /* ======================= Testing ======================= */
  push('Testing', {
    t: 'Spring Boot test slices',
    x: '@SpringBootTest starts the whole application, which is thorough but slow. Slice annotations start only one layer: @WebMvcTest for controllers, @DataJpaTest for repositories. Mock everything outside the slice.',
    draw: () => R(
      C(B('@SpringBootTest', 'c-r', 'whole context · slowest', 0), N('end-to-end inside the app')),
      C(B('@WebMvcTest', 'c-b', 'controllers + MockMvc', 1), N('services mocked with @MockitoBean')),
      C(B('@DataJpaTest', 'c-g', 'JPA repositories only', 2), N('each test rolls back')),
      C(B('Plain JUnit', 'c-t', 'no Spring at all', 3), N('fastest, for business logic'))),
    more: [
      '@MockitoBean replaces @MockBean, which is deprecated since Spring Boot 3.4.',
      '@DataJpaTest uses an embedded database by default. Pair it with Testcontainers to test against your real database.',
      'Spring caches contexts between tests. Different @MockitoBean sets create new contexts and slow the suite down.',
      'Most logic should be tested without Spring. Constructor injection makes that easy.'
    ],
    ex: `@WebMvcTest(UserController.class)
class UserControllerTest {
    @Autowired MockMvc mvc;
    @MockitoBean UserService service;

    @Test
    void returns404WhenMissing() throws Exception {
        when(service.find(42L)).thenThrow(new UserNotFound(42L));
        mvc.perform(get("/api/users/42"))
           .andExpect(status().isNotFound());
    }
}

@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Testcontainers
class OrderRepoTest {
    @Container @ServiceConnection
    static PostgreSQLContainer<?> db = new PostgreSQLContainer<>("postgres:16");
}`
  });

  /* ---------- steps without their own example must not borrow one by index ---------- */
  LESSONS.forEach(l => l.steps.forEach(s => {
    if (!('ex' in s)) s.ex = '';
    if (!('more' in s)) s.more = [];
  }));

  // rebuild the flat list and redraw
  FLAT.length = 0;
  LESSONS.forEach((l, li) => l.steps.forEach((s, si) => FLAT.push({ li, si, l, s })));
  k = 0;
  render();
})();
