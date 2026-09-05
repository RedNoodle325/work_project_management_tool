# Railway deployment

This app runs as one Next.js service with Railway PostgreSQL and a private Railway Storage Bucket.

## Services

1. Create a Railway project.
2. Add PostgreSQL.
3. Add a Storage Bucket in the same region as the app.
4. Add this GitHub repository as a service and set its root directory to `/worky-next`.
5. Generate a public domain for the app service.

## App variables

Set these variables on the app service:

```text
DATABASE_URL=${{Postgres.DATABASE_URL}}
JWT_SECRET=<at least 32 random characters>
```

Use Railway's bucket credential injection to add `BUCKET`, `ENDPOINT`, `ACCESS_KEY_ID`, `SECRET_ACCESS_KEY`, and `REGION` to the app service. The app also accepts the prefixed equivalents `S3_BUCKET`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, and `S3_REGION`.

The start command automatically applies pending SQL migrations before starting Next.js. On the first visit, create the owner account. The owner can then create Project Manager, Sales, Service Operations, Technician, Scheduler, Viewer, and Administrator accounts under Settings > Users.

## Intake workflow

Project Managers and Sales submit Service Intake requests. Billable work requires a PO number or payment evidence, startups require contract language, and warranty work requires a C-2 number plus warranty details. Service Operations, Administrators, and the Owner review requests. Approval creates the formal work order and links it back to the request.
