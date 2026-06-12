use prometheus::{Counter, CounterVec, Histogram, HistogramOpts, Opts, Registry};

pub struct Metrics {
    pub payments_processed_total: Counter,
    pub payments_matched_total: Counter,
    pub payments_unmatched_total: Counter,
    pub stream_disconnects_total: Counter,
    pub payment_processing_duration_ms: Histogram,
}

impl Metrics {
    pub fn new(registry: &Registry) -> Self {
        let payments_processed_total = Counter::with_opts(
            Opts::new("payments_processed_total", "Total payments processed from Horizon"),
        )
        .unwrap();
        registry.register(Box::new(payments_processed_total.clone())).unwrap();

        let payments_matched_total = Counter::with_opts(
            Opts::new("payments_matched_total", "Payments matched to invoices"),
        )
        .unwrap();
        registry.register(Box::new(payments_matched_total.clone())).unwrap();

        let payments_unmatched_total = Counter::with_opts(
            Opts::new("payments_unmatched_total", "Payments not matched to any invoice"),
        )
        .unwrap();
        registry.register(Box::new(payments_unmatched_total.clone())).unwrap();

        let stream_disconnects_total = Counter::with_opts(
            Opts::new("reconciler_stream_disconnects_total", "Horizon SSE stream disconnections"),
        )
        .unwrap();
        registry.register(Box::new(stream_disconnects_total.clone())).unwrap();

        let payment_processing_duration_ms = Histogram::with_opts(
            HistogramOpts::new("payment_processing_duration_ms", "Payment processing time in ms")
                .buckets(vec![1.0, 5.0, 10.0, 25.0, 50.0, 100.0, 250.0, 500.0, 1000.0]),
        )
        .unwrap();
        registry.register(Box::new(payment_processing_duration_ms.clone())).unwrap();

        Self {
            payments_processed_total,
            payments_matched_total,
            payments_unmatched_total,
            stream_disconnects_total,
            payment_processing_duration_ms,
        }
    }
}
