

const SAFE_SLUG = /^[a-z0-9/]+(?:-[a-z0-9/]+)*$/; //validates URL-safe document slugs in kebab-case format

export function isValidSlug(slug: string | undefined): boolean {
    if (slug === undefined || slug === '') {
        return true; // allow empty slug for root document
    }
    return SAFE_SLUG.test(slug);
}