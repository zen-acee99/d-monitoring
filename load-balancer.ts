import { createLoadBalancer } from "./server/load-balancer.js";

export * from "./server/load-balancer.js";

const lb = createLoadBalancer();
lb.start().catch((err) => {
  console.error("Failed to start DICT Load Balancer:", err);
  process.exit(1);
});
