import { onRequestPost as __api_generate_js_onRequestPost } from "/home/d017032/dev/sitelogic/apps/intake/functions/api/generate.js"
import { onRequestGet as __api_health_js_onRequestGet } from "/home/d017032/dev/sitelogic/apps/intake/functions/api/health.js"
import { onRequestGet as __api_intake_complete_js_onRequestGet } from "/home/d017032/dev/sitelogic/apps/intake/functions/api/intake-complete.js"
import { onRequestPost as __api_intake_complete_js_onRequestPost } from "/home/d017032/dev/sitelogic/apps/intake/functions/api/intake-complete.js"
import { onRequestGet as __api_intake_next_v2_js_onRequestGet } from "/home/d017032/dev/sitelogic/apps/intake/functions/api/intake-next-v2.js"
import { onRequestPost as __api_intake_next_v2_js_onRequestPost } from "/home/d017032/dev/sitelogic/apps/intake/functions/api/intake-next-v2.js"
import { onRequestPost as __api_intake_start_v2_js_onRequestPost } from "/home/d017032/dev/sitelogic/apps/intake/functions/api/intake-start-v2.js"
import { onRequestGet as __api_status_js_onRequestGet } from "/home/d017032/dev/sitelogic/apps/intake/functions/api/status.js"
import { onRequest as __api_preflight_gbp_js_onRequest } from "/home/d017032/dev/sitelogic/apps/intake/functions/api/preflight-gbp.js"
import { onRequest as __api_preflight_preview_js_onRequest } from "/home/d017032/dev/sitelogic/apps/intake/functions/api/preflight-preview.js"
import { onRequest as __api_preflight_recon_js_onRequest } from "/home/d017032/dev/sitelogic/apps/intake/functions/api/preflight-recon.js"
import { onRequest as __api_preflight_start_js_onRequest } from "/home/d017032/dev/sitelogic/apps/intake/functions/api/preflight-start.js"
import { onRequest as __api_preflight_status_js_onRequest } from "/home/d017032/dev/sitelogic/apps/intake/functions/api/preflight-status.js"
import { onRequest as __api_submit_js_onRequest } from "/home/d017032/dev/sitelogic/apps/intake/functions/api/submit.js"

export const routes = [
    {
      routePath: "/api/generate",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_generate_js_onRequestPost],
    },
  {
      routePath: "/api/health",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_health_js_onRequestGet],
    },
  {
      routePath: "/api/intake-complete",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_intake_complete_js_onRequestGet],
    },
  {
      routePath: "/api/intake-complete",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_intake_complete_js_onRequestPost],
    },
  {
      routePath: "/api/intake-next-v2",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_intake_next_v2_js_onRequestGet],
    },
  {
      routePath: "/api/intake-next-v2",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_intake_next_v2_js_onRequestPost],
    },
  {
      routePath: "/api/intake-start-v2",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_intake_start_v2_js_onRequestPost],
    },
  {
      routePath: "/api/status",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_status_js_onRequestGet],
    },
  {
      routePath: "/api/preflight-gbp",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_preflight_gbp_js_onRequest],
    },
  {
      routePath: "/api/preflight-preview",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_preflight_preview_js_onRequest],
    },
  {
      routePath: "/api/preflight-recon",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_preflight_recon_js_onRequest],
    },
  {
      routePath: "/api/preflight-start",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_preflight_start_js_onRequest],
    },
  {
      routePath: "/api/preflight-status",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_preflight_status_js_onRequest],
    },
  {
      routePath: "/api/submit",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_submit_js_onRequest],
    },
  ]