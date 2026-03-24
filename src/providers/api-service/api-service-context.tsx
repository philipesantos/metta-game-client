import React from "react";
import type {RestService} from "../../api/rest-service.ts";

export const ApiServiceContext = React.createContext<RestService | null>(null);
