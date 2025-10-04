"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Save, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import { TenantPrisma } from "@/lib/tenant-guard"

interface AdminPoliciesTabProps {
  tenant: TenantPrisma
  session: { userId: string; companyId: string; role: string }
}

interface ApprovalPolicy {
  id: string
  type: "MAJORITY" | "PERCENTAGE"
  thresholdPercent?: number | null
  maxPerEmployeeMinor: bigint
  largeExpenseThresholdMinor: bigint
  requireCeoForLarge: boolean
}

export function AdminPoliciesTab({ tenant }: AdminPoliciesTabProps) {
  const [policy, setPolicy] = useState<ApprovalPolicy | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  // Load policy on mount
  useState(() => {
    const loadPolicy = async () => {
      try {
        const data = await tenant.approvalPolicy.findMany()
        if (data.length > 0) {
          setPolicy(data[0]) // Get first policy (should be only one per company)
        } else {
          // Create default policy if none exists
          const defaultPolicy = await tenant.raw.approvalPolicy.create({
            data: {
              companyId: tenant.getCompanyId(),
              type: "MAJORITY",
              maxPerEmployeeMinor: BigInt(100000), // $1,000
              largeExpenseThresholdMinor: BigInt(500000), // $5,000
              requireCeoForLarge: true,
            }
          })
          setPolicy(defaultPolicy)
        }
      } catch {
        toast.error("Failed to load approval policy")
      } finally {
        setIsLoading(false)
      }
    }
    loadPolicy()
  })

  const handleUpdatePolicy = async (formData: FormData) => {
    if (!policy) return

    const type = formData.get("type") as "MAJORITY" | "PERCENTAGE"
    const thresholdPercent = formData.get("thresholdPercent") ? parseInt(formData.get("thresholdPercent") as string) : null
    const maxPerEmployeeMinor = BigInt(formData.get("maxPerEmployeeMinor") as string)
    const largeExpenseThresholdMinor = BigInt(formData.get("largeExpenseThresholdMinor") as string)
    const requireCeoForLarge = formData.get("requireCeoForLarge") === "on"

    startTransition(async () => {
      try {
        const updatedPolicy = await tenant.approvalPolicy.update({
          where: { id: policy.id },
          data: {
            type,
            thresholdPercent,
            maxPerEmployeeMinor,
            largeExpenseThresholdMinor,
            requireCeoForLarge,
          }
        })

        setPolicy(updatedPolicy)
        toast.success("Approval policy updated successfully")
        router.refresh()
      } catch {
        toast.error("Failed to update approval policy")
      }
    })
  }

  if (isLoading) {
    return <div>Loading policy settings...</div>
  }

  if (!policy) {
    return <div>No approval policy found</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Approval Policies</h2>
        <p className="text-muted-foreground">Configure expense approval rules and thresholds</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Approval Policy Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form action={handleUpdatePolicy} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="type">Approval Type</Label>
                <Select name="type" defaultValue={policy.type}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select approval type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MAJORITY">Majority Approval</SelectItem>
                    <SelectItem value="PERCENTAGE">Percentage Threshold</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  {policy.type === "MAJORITY"
                    ? "Requires majority of managers to approve"
                    : "Requires specific percentage of managers to approve"
                  }
                </p>
              </div>

              {policy.type === "PERCENTAGE" && (
                <div>
                  <Label htmlFor="thresholdPercent">Threshold Percentage</Label>
                  <Input
                    id="thresholdPercent"
                    name="thresholdPercent"
                    type="number"
                    min="1"
                    max="100"
                    defaultValue={policy.thresholdPercent || ""}
                    placeholder="75"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Percentage of managers required to approve
                  </p>
                </div>
              )}

              <div>
                <Label htmlFor="maxPerEmployeeMinor">Max Per Employee (cents)</Label>
                <Input
                  id="maxPerEmployeeMinor"
                  name="maxPerEmployeeMinor"
                  type="number"
                  min="0"
                  defaultValue={policy.maxPerEmployeeMinor.toString()}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Maximum amount employee can spend without approval
                </p>
              </div>

              <div>
                <Label htmlFor="largeExpenseThresholdMinor">Large Expense Threshold (cents)</Label>
                <Input
                  id="largeExpenseThresholdMinor"
                  name="largeExpenseThresholdMinor"
                  type="number"
                  min="0"
                  defaultValue={policy.largeExpenseThresholdMinor.toString()}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Expenses above this amount require special handling
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="requireCeoForLarge"
                name="requireCeoForLarge"
                defaultChecked={policy.requireCeoForLarge}
              />
              <Label htmlFor="requireCeoForLarge">Require CEO approval for large expenses</Label>
            </div>

            <Button type="submit" disabled={isPending}>
              <Save className="h-4 w-4 mr-2" />
              Save Policy
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Policy Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Policy Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-semibold mb-2">Current Policy Rules</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Approval Type:</span>
                  <Badge variant="outline" className="ml-2">
                    {policy.type === "MAJORITY" ? "Majority" : "Percentage"}
                  </Badge>
                </div>
                {policy.type === "PERCENTAGE" && policy.thresholdPercent && (
                  <div>
                    <span className="font-medium">Threshold:</span>
                    <span className="ml-2">{policy.thresholdPercent}%</span>
                  </div>
                )}
                <div>
                  <span className="font-medium">Employee Max:</span>
                  <span className="ml-2">${(policy.maxPerEmployeeMinor / BigInt(100)).toString()}</span>
                </div>
                <div>
                  <span className="font-medium">Large Expense Threshold:</span>
                  <span className="ml-2">${(policy.largeExpenseThresholdMinor / BigInt(100)).toString()}</span>
                </div>
                <div className="md:col-span-2">
                  <span className="font-medium">CEO Required for Large Expenses:</span>
                  <Badge variant={policy.requireCeoForLarge ? "default" : "secondary"} className="ml-2">
                    {policy.requireCeoForLarge ? "Yes" : "No"}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="p-4 border rounded-lg">
              <h4 className="font-semibold mb-2">How It Works</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• Expenses under ${(policy.maxPerEmployeeMinor / BigInt(100)).toString()} don&apos;t need approval</li>
                <li>• Expenses over ${(policy.largeExpenseThresholdMinor / BigInt(100)).toString()} require CEO approval</li>
                <li>• Other expenses need manager approval based on policy type</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
