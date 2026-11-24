// The desktop's first import (main.ts): before any module reads the environment, no cloud
// switch is left in it and no lookup of T3's hosts answers (stemcells/privacy/closed.ts).
import { closeToT3 } from "../../../../../stemcells/privacy/closed.ts";

closeToT3();
