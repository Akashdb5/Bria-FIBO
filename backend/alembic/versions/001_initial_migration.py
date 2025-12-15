"""Initial migration with all tables

Revision ID: 001
Revises: 
Create Date: 2024-12-15 18:31:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create fibo_users table
    op.create_table('fibo_users',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('email', sa.String(), nullable=False),
        sa.Column('password_hash', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email')
    )
    op.create_index(op.f('ix_fibo_users_email'), 'fibo_users', ['email'], unique=False)

    # Create fibo_nodes table
    op.create_table('fibo_nodes',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('node_type', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('input_schema', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('output_schema', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('node_type')
    )
    op.create_index(op.f('ix_fibo_nodes_node_type'), 'fibo_nodes', ['node_type'], unique=False)

    # Create fibo_workflows table
    op.create_table('fibo_workflows',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False),
        sa.Column('workflow_definition', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['fibo_users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_fibo_workflows_user_id'), 'fibo_workflows', ['user_id'], unique=False)

    # Create fibo_workflow_runs table
    op.create_table('fibo_workflow_runs',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('workflow_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('execution_snapshot', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.CheckConstraint("status IN ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'WAITING_APPROVAL')", name='valid_status'),
        sa.ForeignKeyConstraint(['workflow_id'], ['fibo_workflows.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_fibo_workflow_runs_status'), 'fibo_workflow_runs', ['status'], unique=False)
    op.create_index(op.f('ix_fibo_workflow_runs_workflow_id'), 'fibo_workflow_runs', ['workflow_id'], unique=False)


def downgrade() -> None:
    # Drop tables in reverse order
    op.drop_index(op.f('ix_fibo_workflow_runs_workflow_id'), table_name='fibo_workflow_runs')
    op.drop_index(op.f('ix_fibo_workflow_runs_status'), table_name='fibo_workflow_runs')
    op.drop_table('fibo_workflow_runs')
    
    op.drop_index(op.f('ix_fibo_workflows_user_id'), table_name='fibo_workflows')
    op.drop_table('fibo_workflows')
    
    op.drop_index(op.f('ix_fibo_nodes_node_type'), table_name='fibo_nodes')
    op.drop_table('fibo_nodes')
    
    op.drop_index(op.f('ix_fibo_users_email'), table_name='fibo_users')
    op.drop_table('fibo_users')