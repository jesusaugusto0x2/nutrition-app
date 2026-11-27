CREATE TABLE "patient_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"patient_id" uuid NOT NULL,
	"clinic_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_by" uuid NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "patient_notes" ADD CONSTRAINT "patient_notes_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_notes" ADD CONSTRAINT "patient_notes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_notes" ADD CONSTRAINT "patient_notes_patient_id_clinic_id_patients_id_clinic_id_fk" FOREIGN KEY ("patient_id","clinic_id") REFERENCES "public"."patients"("id","clinic_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "patient_notes_patient_id_index" ON "patient_notes" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "patient_notes_clinic_id_index" ON "patient_notes" USING btree ("clinic_id");