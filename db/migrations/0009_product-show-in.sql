CREATE TYPE "public"."product_show_in" AS ENUM('both', 'wholesale', 'retail');--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "show_in" "product_show_in" DEFAULT 'both' NOT NULL;