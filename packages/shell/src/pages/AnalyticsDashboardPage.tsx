import React, { useEffect, useState } from 'react';
import './AnalyticsDashboardPage.css';

interface DashboardData {
  totalEvents: number;
  uniqueSessions: number;
  pageViews: number;
  productViews: number;
  cartAdditions: number;
  checkoutStarts: number;
  prefetchHits: number;
  conversionRate: number;
  topProducts: Array<{ slug: string; views: number }>;
  topCategories: Array<{ category: string; count: number }>;
}

const AnalyticsDashboardPage: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/analytics/dashboard');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 10000); // Auto-refresh every 10s
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="analytics-page container animate-fade-in">
      <div className="analytics-page__header">
        <div>
          <h1 className="analytics-page__title">Edge Analytics & Insights</h1>
          <p className="analytics-page__subtitle">
            Real-time clickstream processing, conversion funnel, and edge predictive prefetch performance.
          </p>
        </div>
        <button
          className="analytics-page__refresh-btn"
          onClick={fetchStats}
          disabled={loading}
        >
          {loading ? 'Refreshing...' : '↻ Refresh'}
        </button>
      </div>

      {error && (
        <div className="analytics-page__alert" role="alert">
          {error}
        </div>
      )}

      {data && (
        <>
          {/* Key Metric KPI Cards */}
          <div className="analytics-grid">
            <div className="analytics-card">
              <span className="card-label">Total Clickstream Events</span>
              <span className="card-value">{data.totalEvents.toLocaleString()}</span>
              <span className="card-tag">Ingested via Express Gateway</span>
            </div>

            <div className="analytics-card">
              <span className="card-label">Unique Sessions</span>
              <span className="card-value">{data.uniqueSessions.toLocaleString()}</span>
              <span className="card-tag">Session Tracking</span>
            </div>

            <div className="analytics-card">
              <span className="card-label">Cart Conversion Rate</span>
              <span className="card-value text-accent">{data.conversionRate}%</span>
              <span className="card-tag">Cart Adds / Product Views</span>
            </div>

            <div className="analytics-card">
              <span className="card-label">Predictive Prefetch Hits</span>
              <span className="card-value text-success">{data.prefetchHits}</span>
              <span className="card-tag">
                ~{(data.prefetchHits * 85).toFixed(0)}ms latency saved
              </span>
            </div>
          </div>

          {/* Funnel & Traffic Visuals */}
          <div className="analytics-sections-grid">
            {/* Conversion Funnel */}
            <div className="analytics-panel">
              <h2 className="panel-title">E-Commerce Conversion Funnel</h2>
              <div className="funnel">
                <div className="funnel-step">
                  <div className="funnel-step__info">
                    <span>1. Page Views</span>
                    <span className="step-val">{data.pageViews}</span>
                  </div>
                  <div className="funnel-bar" style={{ width: '100%' }} />
                </div>

                <div className="funnel-step">
                  <div className="funnel-step__info">
                    <span>2. Product Details Viewed</span>
                    <span className="step-val">{data.productViews}</span>
                  </div>
                  <div
                    className="funnel-bar funnel-bar--2"
                    style={{
                      width: `${data.pageViews ? Math.min(100, (data.productViews / data.pageViews) * 100) : 0}%`,
                    }}
                  />
                </div>

                <div className="funnel-step">
                  <div className="funnel-step__info">
                    <span>3. Added to Bag</span>
                    <span className="step-val">{data.cartAdditions}</span>
                  </div>
                  <div
                    className="funnel-bar funnel-bar--3"
                    style={{
                      width: `${data.pageViews ? Math.min(100, (data.cartAdditions / data.pageViews) * 100) : 0}%`,
                    }}
                  />
                </div>

                <div className="funnel-step">
                  <div className="funnel-step__info">
                    <span>4. Checkout Initiated</span>
                    <span className="step-val">{data.checkoutStarts}</span>
                  </div>
                  <div
                    className="funnel-bar funnel-bar--4"
                    style={{
                      width: `${data.pageViews ? Math.min(100, (data.checkoutStarts / data.pageViews) * 100) : 0}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Top Products & Categories */}
            <div className="analytics-panel">
              <h2 className="panel-title">Top Viewed Products</h2>
              {data.topProducts.length === 0 ? (
                <p className="empty-text">No product views recorded yet.</p>
              ) : (
                <div className="table-responsive">
                  <table className="analytics-table">
                    <thead>
                      <tr>
                        <th>Product Slug</th>
                        <th className="text-right">Views</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.topProducts.map((p) => (
                        <tr key={p.slug}>
                          <td className="font-mono">{p.slug}</td>
                          <td className="text-right font-bold">{p.views}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <h2 className="panel-title mt-4">Top Categories</h2>
              <div className="category-tags">
                {data.topCategories.map((c) => (
                  <span key={c.category} className="cat-pill">
                    {c.category} ({c.count})
                  </span>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AnalyticsDashboardPage;
