import { describe, expect, it } from "vite-plus/test";

import { type RiskKind, riskFindings } from "./floor";

// The Swift app's fixtures, its names swapped for invented ones.

const kinds = (text: string) => riskFindings(text).map((finding) => finding.kind);
const triggers = (text: string) =>
  riskFindings(text).map((finding) => `${finding.kind}:${text.slice(finding.start, finding.end)}`);

describe("the risk floor", () => {
  it.each<[string, RiskKind]>([
    // history
    ["Force push the branch when you're done.", "history"],
    ["then force-push to origin", "history"],
    ["git push --force origin main", "history"],
    ["push it with force", "history"],
    ["Do a git reset --hard to the last tag.", "history"],
    ["hard reset main to origin", "history"],
    ["Delete the old feature branches.", "history"],
    ["do delete the branch", "history"], // a dictation flip of "don't"
    ["remove the v2 tag from the remote", "history"],
    ["rewrite the git history to drop the secret", "history"],
    ["git branch -D fix/old", "history"],
    // deletion
    ["rm -rf ~/Documents", "deletion"],
    ["run rm -rf / to clean up", "deletion"],
    ["Drop table users.", "deletion"],
    ["truncate table orders", "deletion"],
    ["delete from customers where 1=1", "deletion"],
    ["Wipe the database and reseed it.", "deletion"],
    ["delete the repo", "deletion"],
    ["Remove the whole project folder.", "deletion"],
    ["delete everything in the home directory", "deletion"],
    ["delete all the files", "deletion"],
    ["clear the production database", "deletion"],
    ["empty the trash", "deletion"],
    ["terraform destroy the staging stack", "deletion"],
    ["kubectl delete namespace prod", "deletion"],
    ["purge the S3 bucket", "deletion"],
    ["delete the user accounts that never logged in", "deletion"],
    ["remove all customers from the mailing tool", "deletion"],
    // access
    ["Revoke the API keys.", "access"],
    ["rotate the tokens for the bot", "access"],
    ["commit the .env file", "access"],
    ["paste the password into the README", "access"],
    ["make the repo public", "access"],
    ["disable 2FA on the account", "access"],
    ["give Ilse admin access to the org", "access"],
    ["chmod 777 the uploads folder", "access"],
    // outreach
    ["Send an email to all customers about the delay.", "outreach"],
    ["email Ilse the report", "outreach"],
    ["DM the team on Slack", "outreach"],
    ["post it to #general", "outreach"],
    ["Post the results on LinkedIn.", "outreach"],
    ["reply to the reviews on the review site", "outreach"],
    ["send the summary to Ilse", "outreach"],
    ["send out the newsletter", "outreach"],
    ["tweet the launch", "outreach"],
    // money
    ["buy the domain example-shop.app", "money"],
    ["Pay the invoice from Vercel.", "money"],
    ["refund the order for Jane", "money"],
    ["charge the customer's card", "money"],
    ["send $500 to Ilse", "money"],
    ["upgrade to the pro plan", "money"],
    ["raise the daily budget to 200", "money"],
    // release
    ["deploy to production", "release"],
    ["Deploy it.", "release"],
    ["npm publish the package", "release"],
    ["ship it to the App Store", "release"],
    ["publish the blog post", "release"],
    ["release v2.1 tonight", "release"],
    ["push the build to TestFlight", "release"],
    ["the site goes live at noon", "release"],
  ])("flags %j as %s", (text, kind) => {
    expect(kinds(text)).toContain(kind);
  });

  it.each([
    "delete the unused import",
    "remove the dead code in the database layer",
    "Delete the unused import in the database layer.",
    "remove the debug print statements",
    "delete the old tests for the parser",
    "rm -rf node_modules and reinstall",
    "rm -rf .build",
    "clear the cache",
    "remove the home button from the toolbar",
    "fix the delete branch button",
    "rename the branch name label",
    "add a force-push guard to the merge queue",
    "the token count is wrong",
    "show the deploy status in the rail",
    "deploy to staging",
    "deploy the preview build to my phone",
    "pay attention to the edge cases",
    "fix the refund flow on the checkout page",
    "add a buy button",
    "get buy-in from the team",
    "Find from Slack Ilse's message to me that has the credentials",
    "send the request to the API",
    "post the form to the endpoint",
    "send a POST request to Stripe",
    "send an email when the order ships",
    "release the lock before returning",
    "publish the event to the bus",
    "remove the key from the dictionary",
    "make the property public",
    "reset the state when the view appears",
    "the message disappears when I switch tabs",
    "remove the messages from the transcript view",
    "Add a Tab autocomplete for project names",
    "Review the Disk page copy",
    "harbor Find from Slack Ilse's message to me that has the credentials of the various social media experiments she ran",
    "drop support for iOS 15",
    "delete the file Foo.swift",
    "on delete cascade",
    "revert the last commit",
    "squash the commits on this branch",
    "send emails when orders ship. Talk to Ilse about the copy.",
  ])("passes %j", (text) => {
    expect(triggers(text)).toEqual([]);
  });

  it.each([
    "don't force push",
    "Do not delete the database.",
    "never drop table users",
    "make sure you don't email the customers",
    "never rm -rf the home folder",
  ])("notices the negation in %j", (text) => {
    expect(riskFindings(text)[0]?.negated).toBe(true);
  });

  it.each(["force push", "do delete the branch", "Delete the database now."])(
    "reads %j as asked for",
    (text) => {
      expect(riskFindings(text)[0]?.negated).toBe(false);
    },
  );

  it("lets a negation reach only within its clause and sentence", () => {
    // "No," answers; it doesn't negate what follows.
    expect(riskFindings("No, delete the repo.").map((f) => f.negated)).toEqual([false]);
    expect(riskFindings("no wait — force push it").map((f) => f.negated)).toEqual([false]);
    // A list under one "do not" asks for its later items: a question too
    // many, never one too few.
    expect(
      riskFindings("Do not delete files, empty Trash, or uninstall software.").map(
        (f) => f.negated,
      ),
    ).toEqual([false]);
    expect(
      riskFindings("Don't touch the tests. Force push afterwards.").map((f) => f.negated),
    ).toEqual([false]);
  });

  it("spans the trigger from its verb through its object, in its sentence", () => {
    const text = "Fix the header first. Then delete the old feature branch, and email Ilse!";
    const found = riskFindings(text);
    expect(found.map((f) => f.kind)).toEqual(["history", "outreach"]);
    expect(found.map((f) => text.slice(f.start, f.end))).toEqual([
      "delete the old feature branch",
      "email Ilse",
    ]);
    expect(text.slice(found[0]!.sentence.start, found[0]!.sentence.end)).toBe(
      "Then delete the old feature branch, and email Ilse!",
    );
  });

  it("never splits a sentence at a dotted word, and reads a list's lines one by one", () => {
    const dotted = "commit the .env file and release v2.1 now";
    const found = riskFindings(dotted);
    expect(found).toHaveLength(2);
    expect(found.every((f) => f.sentence.start === 0 && f.sentence.end === dotted.length)).toBe(
      true,
    );
    const list =
      "3 Cells:\n1. Fix the composer flicker\n2. force push the fix\n3. Review the Disk page copy";
    const item = riskFindings(list);
    expect(item.map((f) => list.slice(f.sentence.start, f.sentence.end))).toEqual([
      "2. force push the fix",
    ]);
  });

  it("finds one thing for one phrase, money before outreach, and nothing in nothing", () => {
    expect(kinds("send $500 to Ilse")).toEqual(["money"]);
    expect(riskFindings("")).toEqual([]);
  });
});
