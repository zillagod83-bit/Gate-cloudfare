import { Switch, Route } from "wouter";
import { Layout } from "./components/layout";
import Home from "./pages/home";
import Practice from "./pages/practice";
import Settings from "./pages/settings";
import OCR from "./pages/ocr";
import NotFound from "./pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/practice" component={Practice} />
      <Route path="/settings" component={Settings} />
      <Route path="/ocr" component={OCR} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <Layout>
      <Router />
    </Layout>
  );
}

export default App;
