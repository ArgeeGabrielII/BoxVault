import { Component, type ReactNode } from 'react';
export default class RouteErrorBoundary extends Component<{ children: ReactNode; route: string }, { failed: boolean }> {
 state = { failed: false };
 static getDerivedStateFromError() { return { failed: true }; }
 componentDidUpdate(previous: { route: string }) { if (previous.route !== this.props.route && this.state.failed) this.setState({ failed: false }); }
 render() { return this.state.failed ? <main className="route-loading" role="alert"><img src="/brand/logo.svg" alt="BoxVault" width="48" height="48"/><h1>Let’s try that again.</h1><p>The preview could not finish loading. Refresh the page or return to the website.</p><button className="primary-button" onClick={() => location.reload()}>Reload preview</button><a href="/">Back to the website</a></main> : this.props.children; }
}
