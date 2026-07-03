import { afterEach, describe, expect, test } from "bun:test";

import { isValidSlug } from "./slug-check";

describe("isValidSlug", () => {
    test("valid slugs", () => {
        expect(isValidSlug("valid-slug")).toBe(true);
        expect(isValidSlug("another-valid-slug123")).toBe(true);
        expect(isValidSlug("slug")).toBe(true);
        expect(isValidSlug("folder/slug-with-multiple-parts")).toBe(true);
        expect(isValidSlug("")).toBe(true);
    });

    test("invalid slugs", () => {
        expect(isValidSlug("../passwords")).toBe(false); // directory traversal
        expect(isValidSlug("invalid_slug")).toBe(false); // underscores
        expect(isValidSlug("invalid slug")).toBe(false); // spaces
        expect(isValidSlug("-leading-dash")).toBe(false); // leading dash
        expect(isValidSlug("trailing-dash-")).toBe(false); // trailing dash
        expect(isValidSlug("double--dash")).toBe(false); // double dash
    });
});