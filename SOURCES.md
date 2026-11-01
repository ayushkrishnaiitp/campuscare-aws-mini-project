# Sources for the CampusCare AWS plan

## AWS Free Tier / current account plan

- AWS Free Tier page: https://aws.amazon.com/free/
- The page states that a new Free account receives $100 in credits immediately and may earn up to $100 more, up to $200 over six months. It says the account closes six months after opening or when credits run out, whichever comes first; no charges are incurred unless the user converts to a Paid plan or activates paid-only services. Credits and service access remain subject to account plan and eligibility.

## AWS service pricing and calculator

- AWS Pricing Calculator: https://calculator.aws/
- EC2 On-Demand pricing: https://aws.amazon.com/ec2/pricing/on-demand/ — On-Demand compute is billed by instance usage; the page also notes that usage continues until an instance is stopped or terminated. Region and instance type affect rates.
- RDS for PostgreSQL pricing: https://aws.amazon.com/rds/postgresql/pricing/ — Single-AZ DB instances are billed per instance-hour, with separate database storage and other possible charges; region, instance, deployment, storage, and usage affect the estimate.
- Amazon S3 pricing: https://aws.amazon.com/s3/pricing/ — charges can include storage, requests, retrieval, and data transfer; small usage still depends on the chosen region and request pattern.
- Amazon CloudWatch pricing: https://aws.amazon.com/cloudwatch/pricing/ — logs, metrics, alarms, and other features can be chargeable; the page says regional prices vary. The page's examples include a $0.50/GB Logs ingestion example, but example rates are not a Mumbai quote.
- AWS Budgets cost management: https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-managing-costs.html — cost budgets can be used to track costs and notify at configured actual or forecast thresholds.

## INR conversion assumption

- USD/INR daily reference series (source named on page: European Central Bank): https://www.ycharts.com/indicators/us_dollar_to_indian_rupee_exchange_rate
- The opened page reports ₹94.96 per USD for 30 October 2026. A rounded ₹95/USD can be used for a clearly labeled planning estimate; it is not an AWS billing exchange guarantee.

## AWS regional public price-list files checked

- EC2 Mumbai/ap-south-1 list: https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonEC2/current/ap-south-1/index.json (HTTP Last-Modified observed: 29 October 2026; JSON ~301 MiB).
- RDS Mumbai/ap-south-1 list: https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonRDS/current/ap-south-1/index.json (HTTP Last-Modified observed: 29 October 2026; JSON ~21 MiB).

Do not treat AWS Free Plan credits as a guaranteed $0 bill or apply the legacy “12-month Free Tier” model. The INR slide should state the region, resources, hours, storage, traffic/logging assumptions, tax exclusion, exchange-rate date, and that actual charges vary by account plan, eligible services, region, and usage. Recalculate in AWS Pricing Calculator and set an AWS Budgets alert before any approved AWS deployment.
