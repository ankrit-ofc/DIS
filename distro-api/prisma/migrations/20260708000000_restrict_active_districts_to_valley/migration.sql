-- Data migration: DISTRO serves only the Kathmandu Valley for now.
-- Keep every District row (orders/profiles reference them) — only flip flags.
-- Table name is PascalCase `District`: prod MySQL (Railway) is case-sensitive.

-- Ensure the three valley districts exist (id has no DB default; UUID() is fine
-- alongside app-generated cuids).
INSERT INTO `District` (`id`, `name`, `deliveryFee`, `active`, `estimatedDays`)
SELECT UUID(), 'Kathmandu', 0, true, 1 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `District` WHERE `name` = 'Kathmandu');

INSERT INTO `District` (`id`, `name`, `deliveryFee`, `active`, `estimatedDays`)
SELECT UUID(), 'Lalitpur', 0, true, 1 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `District` WHERE `name` = 'Lalitpur');

INSERT INTO `District` (`id`, `name`, `deliveryFee`, `active`, `estimatedDays`)
SELECT UUID(), 'Bhaktapur', 0, true, 1 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `District` WHERE `name` = 'Bhaktapur');

-- Only the valley trio stays active.
UPDATE `District` SET `active` = false WHERE `name` NOT IN ('Kathmandu', 'Lalitpur', 'Bhaktapur');
UPDATE `District` SET `active` = true  WHERE `name` IN ('Kathmandu', 'Lalitpur', 'Bhaktapur');
