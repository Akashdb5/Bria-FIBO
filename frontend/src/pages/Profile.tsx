import { useAuth } from '../contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Label } from '../components/ui/label'

const Profile = () => {
    const { user, logout } = useAuth()

    if (!user) {
        return null
    }

    return (
        <div className="max-w-2xl mx-auto">
            <Card>
                <CardHeader>
                    <CardTitle className="text-2xl">Profile</CardTitle>
                    <CardDescription>Manage your account information</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Name</Label>
                            <div className="text-lg font-medium">{user.name}</div>
                        </div>

                        <div className="space-y-2">
                            <Label>Email</Label>
                            <div className="text-lg font-medium">{user.email}</div>
                        </div>

                        <div className="space-y-2">
                            <Label>User ID</Label>
                            <div className="text-sm text-muted-foreground font-mono">{user.id}</div>
                        </div>
                    </div>

                    <div className="pt-6 border-t">
                        <Button
                            variant="destructive"
                            onClick={logout}
                        >
                            Logout
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

export default Profile
